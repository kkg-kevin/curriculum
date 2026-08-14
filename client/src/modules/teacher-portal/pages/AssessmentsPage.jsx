import { useMemo, useState } from "react";
import {
  Assignment as AssignmentIcon,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Quiz as QuizIcon,
  School as SchoolIcon,
  Send as SendIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCurrentCoursesForGrades, useCurriculumCoursesByGrade } from "../../curriculum/hooks/useCurriculumVersion";
import { courseApi } from "../../courses/services/courseApi";
import { useIssueAssessment, useGradeSubmission } from "../../assessments/hooks/useAssessmentSubmission";
import { assessmentSubmissionApi } from "../../assessments/services/assessmentSubmissionApi";
import DiagnosticGradingModal from "../../assessments/components/DiagnosticGradingModal";

const T = {
  accent: "#25476a",
  accentDeep: "#1a3550",
  accentMid: "#2e7db5",
  accentLight: "#38aae1",
  tintBg: "#e8f5fb",
  tintBorder: "#a8d5ee",
  ink: "#111827",
  inkMuted: "#6B7280",
  inkFaint: "#9CA3AF",
  border: "#E5E7EB",
};

const TYPE_LABELS = {
  quiz: "Quiz",
  exam: "Exam",
  assignment: "Assignment",
  project: "Project",
  observation: "Teacher Observation",
};

const TYPE_COLORS = {
  quiz: "#25476a",
  exam: "#38aae1",
  assignment: "#059669",
  project: "#7C3AED",
  observation: "#D97706",
};

const MODE_LABELS = { individual: "Individual", group: "Group" };
const MODE_COLORS = { individual: "#6B7280", group: "#7C3AED" };

const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function KpiTile({ icon, num, label, sub }) {
  return (
    <div style={{ ...cardStyle, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{num}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>{label}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkFaint }}>{sub}</p>}
      </div>
    </div>
  );
}

function badgeStyle(color) {
  return {
    fontSize: "10px",
    fontWeight: "700",
    color,
    backgroundColor: `${color}12`,
    border: `1px solid ${color}35`,
    padding: "2px 8px",
    borderRadius: "20px",
    whiteSpace: "nowrap",
  };
}

function assessmentSummary(assessment) {
  if (assessment.type === "quiz" || assessment.type === "exam") {
    const n = assessment.items?.length || 0;
    return `${n} question${n === 1 ? "" : "s"}`;
  }
  if (assessment.type === "assignment" || assessment.type === "project") {
    const parts = [];
    const tasks = assessment.items?.length || 0;
    if (tasks > 0) parts.push(`${tasks} task${tasks === 1 ? "" : "s"}`);
    const rubric = assessment.rubric?.length || 0;
    if (rubric > 0) parts.push(`${rubric} criteri${rubric === 1 ? "on" : "a"}`);
    return parts.length ? parts.join(" · ") : "0 tasks";
  }
  const indicators = assessment.indicators?.length || 0;
  return `${indicators} indicator${indicators === 1 ? "" : "s"}`;
}

// One eligible class's issue action for one specific (assessment, session) occurrence — either
// a "not yet issued" CTA, or a shortcut into the roster if it already has been.
function IssueRow({ item, cls, issue, onIssue, isIssuing }) {
  const navigate = useNavigate();
  if (issue) {
    return (
      <button
        type="button"
        onClick={() => navigate(`/teacher-portal/assessments/${issue.id}`)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
      >
        <VisibilityIcon sx={{ fontSize: 13 }} /> {cls.gradeName} roster
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onIssue(cls); }}
      disabled={isIssuing}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", backgroundColor: isIssuing ? "#F9FAFB" : "#feb139", color: "#25476a", border: "none", borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isIssuing ? "not-allowed" : "pointer" }}
    >
      <SendIcon sx={{ fontSize: 13 }} /> Issue to {cls.gradeName}
    </button>
  );
}

// One assessment's card, shown once per course no matter how many sessions it's attached to —
// each attached session becomes a compact row underneath instead of a whole repeated card, which
// is what made the previous flat layout hard to scan once an observation/checklist-style
// assessment was reused across many sessions.
function AssessmentGroupCard({ assessment, occurrences, issuesByKey, onIssue, issuingKey }) {
  const color = TYPE_COLORS[assessment.type] || T.accentLight;
  const modeColor = MODE_COLORS[assessment.mode] || T.inkMuted;
  // Pre-filled from the assessment's own authored mode (finally giving that badge real effect),
  // but editable per-issue — a teacher can still override before issuing to any class below.
  const [groupMode, setGroupMode] = useState(assessment.mode === "group");

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${T.accentDeep}, ${T.accentMid})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}>
          {assessment.type === "quiz" ? <QuizIcon fontSize="small" /> : assessment.type === "exam" ? <SchoolIcon fontSize="small" /> : assessment.type === "project" ? <AssignmentIcon fontSize="small" /> : assessment.type === "assignment" ? <DescriptionIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: T.ink }}>{assessment.name}</h4>
          <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {stripHtml(assessment.description) || "No description added"}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={badgeStyle(color)}>{TYPE_LABELS[assessment.type] || assessment.type}</span>
          <span style={badgeStyle(modeColor)}>{MODE_LABELS[assessment.mode] || "Individual"}</span>
          <span style={badgeStyle(T.accent)}>{assessmentSummary(assessment)}</span>
          <span style={badgeStyle(T.inkMuted)}>{occurrences.length} session{occurrences.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: T.inkMuted, cursor: "pointer", alignSelf: "flex-start" }}>
        <input type="checkbox" checked={groupMode} onChange={(e) => setGroupMode(e.target.checked)} />
        Issue as a group assessment — one submission per group, shared mark
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {occurrences.map((occ) => (
          <div key={occ.sessionId} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 10px", backgroundColor: "#FAFBFF", borderRadius: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.inkMuted, minWidth: 90 }}>{occ.sessionLabel}</span>
            {occ.eligibleClasses.map((cls) => {
              const key = `${assessment.id}:${occ.sessionId}:${cls.id}`;
              const item = { id: assessment.id, sessionId: occ.sessionId, courseId: occ.courseId };
              return (
                <IssueRow key={cls.id} item={item} cls={cls} issue={issuesByKey.get(key)} onIssue={(c) => onIssue(item, c, groupMode)} isIssuing={issuingKey === key} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Groups the flat (course, session, assessment) attachment list into one entry per course, and
// within a course, one entry per distinct assessment with every session it's attached to nested
// underneath — see AssessmentGroupCard.
function groupAttachmentsByCourse(attachments) {
  const courseMap = new Map();
  attachments.forEach((att) => {
    if (!courseMap.has(att.courseId)) {
      courseMap.set(att.courseId, { courseId: att.courseId, courseName: att.courseName, sessionIds: new Set(), assessmentMap: new Map() });
    }
    const courseEntry = courseMap.get(att.courseId);
    courseEntry.sessionIds.add(att.sessionId);
    if (!courseEntry.assessmentMap.has(att.id)) courseEntry.assessmentMap.set(att.id, { assessment: att, occurrences: [] });
    courseEntry.assessmentMap.get(att.id).occurrences.push(att);
  });

  return [...courseMap.values()].map((c) => ({
    courseId: c.courseId,
    courseName: c.courseName,
    sessionCount: c.sessionIds.size,
    assessments: [...c.assessmentMap.values()].map((a) => ({
      ...a,
      occurrences: [...a.occurrences].sort((x, y) => (x.sessionOrder || 0) - (y.sessionOrder || 0)),
    })),
  }));
}

// Cross-cutting queue of every submitted-but-ungraded submission across the teacher's classes —
// so pending work is visible without opening each assessment's roster individually to find it.
// Rows tagged isDiagnostic (see AssessmentsPage's diagnosticNeedsGradingRows) have no class
// roster to jump into — those grade inline via the same DiagnosticGradingModal LearnerViewPage.jsx
// uses, instead of navigating to /teacher-portal/assessments/:issueId.
function NeedsGradingSection({ rows, navigate }) {
  const { mutate: grade, isPending: grading } = useGradeSubmission();
  const [gradeOpenId, setGradeOpenId] = useState(null);
  if (rows.length === 0) return null;
  const openRow = rows.find((r) => r.submission.id === gradeOpenId) || null;
  return (
    <div style={{ ...cardStyle, overflow: "hidden", border: "1.5px solid #FED7AA" }}>
      <div style={{ padding: "14px 20px", backgroundColor: "#FFF7ED", borderBottom: `1px solid ${T.border}` }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.05em" }}>Needs Grading</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{rows.length} submission{rows.length === 1 ? "" : "s"} awaiting your review</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map(({ submission, issue, assessment, learner, className, isDiagnostic, group, memberCount }) => (
          <div key={submission.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: `1px solid #F9FAFB`, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
                {group ? `${group.name} · ${memberCount} member${memberCount === 1 ? "" : "s"}` : `${learner.firstName} ${learner.lastName}`}
                {isDiagnostic && <span style={badgeStyle("#D97706")}>Diagnostic</span>}
              </p>
              <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>
                {assessment.name}{className ? ` · ${className}` : ""} · Submitted {new Date(submission.submittedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (isDiagnostic ? setGradeOpenId(submission.id) : navigate(`/teacher-portal/assessments/${issue.id}`))}
              style={{ padding: "7px 16px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Grade →
            </button>
          </div>
        ))}
      </div>

      {openRow && (
        <DiagnosticGradingModal
          title={`Grade Diagnostic — ${openRow.assessment.name}`}
          assessment={openRow.assessment}
          submission={openRow.submission}
          isSaving={grading}
          onSave={(payload) => grade({ id: openRow.submission.id, ...payload }, { onSuccess: () => setGradeOpenId(null) })}
          onClose={() => setGradeOpenId(null)}
        />
      )}
    </div>
  );
}

function CourseSection({ group, isCollapsed, onToggle, issuesByKey, onIssue, issuingKey }) {
  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        {isCollapsed ? <ChevronRightIcon sx={{ color: T.inkFaint }} /> : <ExpandMoreIcon sx={{ color: T.inkFaint }} />}
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>{group.courseName}</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkFaint }}>
            {group.sessionCount} session{group.sessionCount === 1 ? "" : "s"} · {group.assessments.length} assessment{group.assessments.length === 1 ? "" : "s"}
          </p>
        </div>
      </button>
      {!isCollapsed && (
        <div style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {group.assessments.map(({ assessment, occurrences }) => (
            <AssessmentGroupCard key={assessment.id} assessment={assessment} occurrences={occurrences} issuesByKey={issuesByKey} onIssue={onIssue} issuingKey={issuingKey} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const { teacher, teacherLoading, selectedHub, selectedHubId, email } = useOutletContext();
  const [collapsedCourseIds, setCollapsedCourseIds] = useState(() => new Set());

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "byTeacherHub", teacher?.id, selectedHubId],
    queryFn: () => classApi.getAll({ teacherId: teacher.id, schoolId: selectedHubId }),
    enabled: !!teacher?.id && !!selectedHubId,
  });
  const myClasses = classesData?.data || [];
  const gradeIds = [...new Set(myClasses.map((c) => c.gradeId))];

  const { data: courses = [], isLoading: coursesLoading } = useCurriculumCurrentCoursesForGrades(selectedHub?.curriculumId, gradeIds);
  const { data: coursesByGrade } = useCurriculumCoursesByGrade(selectedHub?.curriculumId, gradeIds);

  const sessionsResults = useQueries({
    queries: courses.map((course) => ({
      queryKey: ["teacher-portal", "course-sessions", course.id],
      queryFn: () => courseApi.getSessions(course.id),
      enabled: !!course.id,
    })),
  });

  // Every issue already recorded for each of the teacher's own classes — merged into one lookup
  // keyed by "assessmentId:sessionId:classId" so a card's per-class button can check at a glance
  // whether it's already been issued (and jump straight to that roster instead of re-issuing).
  const issuesResults = useQueries({
    queries: myClasses.map((cls) => ({
      queryKey: ["assessment-issues", "byClass", cls.id],
      queryFn: () => assessmentSubmissionApi.getIssuesForClass(cls.id),
      enabled: !!cls.id,
    })),
  });
  const issuesByKey = useMemo(() => {
    const map = new Map();
    issuesResults.forEach((r) => (r.data?.data || []).forEach((issue) => {
      map.set(`${issue.assessmentId}:${issue.sessionId}:${issue.classId}`, issue);
    }));
    return map;
  }, [issuesResults]);

  // Every submitted-but-ungraded submission across the teacher's classes — see NeedsGradingSection.
  const needsGradingResults = useQueries({
    queries: myClasses.map((cls) => ({
      queryKey: ["assessment-submissions", "needs-grading", cls.id],
      queryFn: () => assessmentSubmissionApi.getNeedsGrading(cls.id),
      enabled: !!cls.id,
    })),
  });
  // Standalone diagnostic submissions (classId: null) for learners in the teacher's classes —
  // invisible to getSubmissionsNeedingGrading above since that's filtered by submission.classId.
  // See getStandaloneSubmissionsNeedingGrading in the service for the class-scoping rationale.
  const diagnosticsNeedingGradingResults = useQueries({
    queries: myClasses.map((cls) => ({
      queryKey: ["assessment-submissions", "diagnostics-needing-grading", cls.id],
      queryFn: () => assessmentSubmissionApi.getDiagnosticsNeedingGrading(cls.id),
      enabled: !!cls.id,
    })),
  });

  const needsGradingRows = useMemo(() => {
    const classById = new Map(myClasses.map((c) => [c.id, c]));
    const rows = [];
    needsGradingResults.forEach((r) => (r.data?.data || []).forEach((row) => {
      rows.push({ ...row, className: classById.get(row.submission.classId)?.gradeName });
    }));
    // A diagnostic issue has no classId of its own to look a class up by — attach the class
    // this particular query was scoped to instead (the loop below is per-class, same as above).
    diagnosticsNeedingGradingResults.forEach((r, i) => (r.data?.data || []).forEach((row) => {
      rows.push({ ...row, className: myClasses[i]?.gradeName, isDiagnostic: true });
    }));
    return rows.sort((a, b) => new Date(a.submission.submittedAt || 0) - new Date(b.submission.submittedAt || 0));
  }, [needsGradingResults, diagnosticsNeedingGradingResults, myClasses]);

  const attachments = useMemo(() => {
    const rows = [];
    sessionsResults.forEach((result, index) => {
      const course = courses[index];
      const eligibleClasses = myClasses.filter((cls) => (coursesByGrade?.get(cls.gradeId) || []).some((c) => c.id === course.id));
      (result.data || []).forEach((session) => {
        (session.attachedAssessments || []).forEach((assessment) => {
          rows.push({
            ...assessment,
            courseId: course.id,
            courseName: course.name,
            sessionId: session.id,
            sessionOrder: session.order || 0,
            sessionLabel: session.title?.trim() || `Session ${session.order || 1}`,
            eligibleClasses,
          });
        });
      });
    });
    return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [courses, sessionsResults, myClasses, coursesByGrade]);

  const courseGroups = useMemo(() => groupAttachmentsByCourse(attachments), [attachments]);

  const toggleCourse = (courseId) => {
    setCollapsedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId); else next.add(courseId);
      return next;
    });
  };

  const { mutate: issueAssessment, isPending: issuing, variables: issuingVariables } = useIssueAssessment();
  const issuingKey = issuing && issuingVariables ? `${issuingVariables.assessmentId}:${issuingVariables.sessionId}:${issuingVariables.classId}` : null;

  const handleIssue = (item, cls, groupMode) => {
    issueAssessment({ assessmentId: item.id, sessionId: item.sessionId, courseId: item.courseId, classId: cls.id, groupMode });
  };

  const isLoading = teacherLoading || (!!teacher && (classesLoading || coursesLoading || sessionsResults.some((r) => r.isLoading)));

  const totalCount = attachments.length;
  const individualCount = attachments.filter((a) => a.mode === "individual").length;
  const groupCount = attachments.filter((a) => a.mode === "group").length;
  const courseCount = courseGroups.length;
  const issuedCount = [...issuesByKey.values()].length;

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading...</div>;
  }

  if (!teacher) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No teacher profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>
          {email ? <>Your account ({email}) isn't linked to a teacher record yet. </> : null}
          Ask your school admin to add you as a teacher using this same email address.
        </p>
      </div>
    );
  }

  if (!selectedHub?.curriculumId) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No curriculum assigned yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>This hub hasn't been assigned a curriculum yet.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>
            My Assessments
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>
            Assessments attached to your assigned classes and course content. Issue one to your class, then grade submissions from its roster.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiTile icon={<DescriptionIcon fontSize="small" />} num={totalCount} label="Available" sub={`${courseCount} course${courseCount === 1 ? "" : "s"} involved`} />
        <KpiTile icon={<SendIcon fontSize="small" />} num={issuedCount} label="Issued" sub="Live for your class right now" />
        <KpiTile icon={<PersonIcon fontSize="small" />} num={individualCount} label="Individual" sub="Teacher-marked or learner work" />
        <KpiTile icon={<GroupIcon fontSize="small" />} num={groupCount} label="Group" sub="Shared activities or group tasks" />
      </div>

      <NeedsGradingSection rows={needsGradingRows} navigate={navigate} />

      {courseGroups.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No assessments attached yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Once your school adds assessments to your class courses, they will show up here automatically.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {courseGroups.map((group) => (
            <CourseSection
              key={group.courseId}
              group={group}
              isCollapsed={collapsedCourseIds.has(group.courseId)}
              onToggle={() => toggleCourse(group.courseId)}
              issuesByKey={issuesByKey}
              onIssue={handleIssue}
              issuingKey={issuingKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}
