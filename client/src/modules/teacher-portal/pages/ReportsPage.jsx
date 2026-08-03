import { useMemo, useState } from "react";
import {
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCoursesByGrade } from "../../curriculum/hooks/useCurriculumVersion";
import { reportApi } from "../../reports/services/reportApi";
import { useGenerateReport } from "../../reports/hooks/useReports";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

const STATUS_CONFIG = {
  not_ready: { label: "Not Ready", bg: "#F9FAFB", color: T.inkMuted, border: T.border },
  ready:     { label: "Ready to Generate", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  draft:     { label: "Draft", bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  published: { label: "Published", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.not_ready;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1.5px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

function rowStatus(row) {
  if (row.report?.status === "published") return "published";
  if (row.report?.status === "draft") return "draft";
  return row.ready ? "ready" : "not_ready";
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

// One learner's status for whichever session is currently selected in the navigator below — a
// plain row (name + status + View once published) rather than a per-learner chip stack, so every
// student's standing for THAT session reads as a single grouped list, the same shape the
// learner's own "My Reports" list uses per report (see ReportRow in ReportsOverview.jsx).
function SessionLearnerRow({ learner, session, navigate }) {
  const published = session?.report?.status === "published";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderBottom: `1px solid #F9FAFB` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: T.ink }}>{learner.firstName} {learner.lastName}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>
          {!session || session.requiredCount === 0 ? "no assessments to report on" : `${session.gradedCount}/${session.requiredCount} assessments graded`}
        </p>
      </div>
      <StatusBadge status={published ? "published" : "not_ready"} />
      {published && (
        <button
          type="button"
          onClick={() => navigate(`/teacher-portal/reports/${session.report.id}`)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          <VisibilityIcon sx={{ fontSize: 13 }} /> View
        </button>
      )}
    </div>
  );
}

// Prev/next between a course's sessions — 16 tabs would be unusable, so this pages one session
// at a time instead, same pattern as any paginated list.
function SessionNavigator({ sessions, index, onChange }) {
  const current = sessions[index];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", backgroundColor: "#FAFBFF", borderBottom: `1px solid ${T.border}` }}>
      <button
        type="button"
        onClick={() => onChange(index - 1)}
        disabled={index === 0}
        style={{ padding: "6px 12px", backgroundColor: "#fff", color: index === 0 ? T.inkFaint : T.accent, border: `1.5px solid ${T.border}`, borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: index === 0 ? "not-allowed" : "pointer" }}
      >
        ‹ Prev
      </button>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink, textAlign: "center" }}>
        Session {index + 1} of {sessions.length}{current?.sessionTitle ? ` — ${current.sessionTitle}` : ""}
      </p>
      <button
        type="button"
        onClick={() => onChange(index + 1)}
        disabled={index === sessions.length - 1}
        style={{ padding: "6px 12px", backgroundColor: "#fff", color: index === sessions.length - 1 ? T.inkFaint : T.accent, border: `1.5px solid ${T.border}`, borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: index === sessions.length - 1 ? "not-allowed" : "pointer" }}
      >
        Next ›
      </button>
    </div>
  );
}

// The course-level final report row — Generate/Review/View, unchanged logic from before the
// per-session breakdown existed; session status now lives in the navigator above instead of
// nested under each learner here.
function ReportRow({ row, cls, course, onGenerate, isGenerating, navigate }) {
  const status = rowStatus(row);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid #F9FAFB` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: T.ink }}>{row.learner.firstName} {row.learner.lastName}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>
          {course.name} · {row.requiredCount === 0
            ? "no assessments to report on"
            : `${row.gradedCount}/${row.requiredCount} assessments graded`}
        </p>
      </div>
      <StatusBadge status={status} />
      {status === "ready" && (
        <button
          type="button"
          onClick={() => onGenerate({ learnerId: row.learner.id, courseId: course.id, classId: cls.id })}
          disabled={isGenerating}
          style={{ padding: "6px 14px", backgroundColor: isGenerating ? "#F9FAFB" : "#feb139", color: "#25476a", border: "none", borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isGenerating ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
        >
          Generate
        </button>
      )}
      {(status === "draft" || status === "published") && (
        <button
          type="button"
          onClick={() => navigate(`/teacher-portal/reports/${row.report.id}`)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          <VisibilityIcon sx={{ fontSize: 13 }} /> {status === "draft" ? "Review" : "View"}
        </button>
      )}
    </div>
  );
}

// One (class, course) card — a session browser (all learners' standing for one session at a
// time, paged via SessionNavigator) sitting above the existing per-learner final-report list.
// Session identity/order is the same across every learner's row, so it's read off the first row.
function CourseReportCard({ cls, course, rows, onGenerate, isGeneratingRow, navigate }) {
  const { requiredCount = 0, attachedCount = 0 } = rows[0] || {};
  const missingCount = attachedCount - requiredCount;
  const sessions = (rows[0]?.sessions || []).filter((s) => s.requiredCount > 0);
  const [sessionIndex, setSessionIndex] = useState(0);
  const activeSession = sessions[Math.min(sessionIndex, sessions.length - 1)];

  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <AssignmentIcon sx={{ fontSize: 18, color: T.accentLight }} />
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{course.name}</p>
          <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>{cls.gradeName || cls.name}</p>
        </div>
      </div>
      {/* A course's sessions can keep referencing assessments that were later deleted —
          those can never be graded, so they're excluded from the requirement. Without
          saying so, the count silently disagrees with the course's own content. */}
      {missingCount > 0 && (
        <div style={{ padding: "8px 20px", backgroundColor: "#FFFBEB", borderBottom: `1px solid #FDE68A`, fontSize: 11.5, color: "#B45309", fontWeight: 600 }}>
          {requiredCount === 0
            ? `All ${attachedCount} assessment${attachedCount === 1 ? "" : "s"} attached to this course have been deleted — there's nothing left to report on.`
            : `${missingCount} of ${attachedCount} attached assessment${attachedCount === 1 ? " has" : "s have"} been deleted and ${missingCount === 1 ? "is" : "are"} excluded from the ${requiredCount} required here.`}
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <SessionNavigator sessions={sessions} index={Math.min(sessionIndex, sessions.length - 1)} onChange={setSessionIndex} />
          {rows.map((row) => (
            <SessionLearnerRow
              key={row.learner.id}
              learner={row.learner}
              session={row.sessions?.find((s) => s.sessionId === activeSession?.sessionId)}
              navigate={navigate}
            />
          ))}
        </>
      )}

      <div style={{ padding: "10px 20px", backgroundColor: "#F9FAFB", borderTop: sessions.length > 0 ? `1px solid ${T.border}` : "none", borderBottom: `1px solid ${T.border}` }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Final Combined Report</p>
      </div>
      {rows.map((row) => (
        <ReportRow
          key={row.learner.id}
          row={row}
          cls={cls}
          course={course}
          onGenerate={onGenerate}
          isGenerating={isGeneratingRow(row, course.id)}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const { teacher, teacherLoading, selectedHub, selectedHubId } = useOutletContext();

  const { data: classesData, isLoading: classesLoading, isError: classesError } = useQuery({
    queryKey: ["classes", "byTeacherHub", teacher?.id, selectedHubId],
    queryFn:  () => classApi.getAll({ teacherId: teacher.id, schoolId: selectedHubId }),
    enabled:  !!teacher?.id && !!selectedHubId,
  });
  const myClasses = classesData?.data || [];
  const gradeIds = [...new Set(myClasses.map((c) => c.gradeId))];

  const { data: coursesByGrade } = useCurriculumCoursesByGrade(selectedHub?.curriculumId, gradeIds);

  const classCoursePairs = useMemo(() => {
    const pairs = [];
    myClasses.forEach((cls) => {
      (coursesByGrade?.get(cls.gradeId) || []).forEach((course) => pairs.push({ cls, course }));
    });
    return pairs;
  }, [myClasses, coursesByGrade]);

  // One batched request per class (returning { [courseId]: rows }) rather than one per
  // class × course pair — a teacher with several classes each exposing several courses was
  // firing dozens of parallel requests just to paint this page.
  const courseIdsByClass = useMemo(() => {
    const map = new Map();
    classCoursePairs.forEach(({ cls, course }) => {
      if (!map.has(cls.id)) map.set(cls.id, []);
      map.get(cls.id).push(course.id);
    });
    return map;
  }, [classCoursePairs]);

  const classIdsWithCourses = [...courseIdsByClass.keys()];
  const readinessResults = useQueries({
    queries: classIdsWithCourses.map((classId) => {
      const courseIds = courseIdsByClass.get(classId);
      return {
        queryKey: ["reports", "readiness", "batch", classId, [...courseIds].sort().join(",")],
        queryFn:  () => reportApi.getReadinessBatch(classId, courseIds),
        enabled:  courseIds.length > 0,
      };
    }),
  });

  const readinessByClass = useMemo(() => {
    const map = new Map();
    classIdsWithCourses.forEach((classId, i) => map.set(classId, readinessResults[i]?.data?.data || {}));
    return map;
  }, [classIdsWithCourses, readinessResults]);

  const sections = classCoursePairs.map(({ cls, course }) => ({
    cls, course, rows: readinessByClass.get(cls.id)?.[course.id] || [],
  })).filter((s) => s.rows.length > 0);

  const allRows = sections.flatMap((s) => s.rows.map((r) => ({ ...r, cls: s.cls, course: s.course })));
  const readyCount = allRows.filter((r) => rowStatus(r) === "ready").length;
  const draftCount = allRows.filter((r) => rowStatus(r) === "draft").length;
  const publishedCount = allRows.filter((r) => rowStatus(r) === "published").length;

  const { mutate: generateReport, isPending: generating, variables: generatingVars } = useGenerateReport();
  // courseId is passed in explicitly rather than read off `row` — the readiness rows the server
  // returns are {learner, requiredCount, gradedCount, ready, report} with no course on them (only
  // the derived `allRows` above attaches one, and that's used purely for the KPI counts), so
  // reaching for row.course.id here threw the moment a teacher actually clicked Generate.
  const isGeneratingRow = (row, courseId) => generating && generatingVars?.learnerId === row.learner.id && generatingVars?.courseId === courseId;

  const handleGenerate = (payload) => {
    generateReport(payload, { onSuccess: (report) => navigate(`/teacher-portal/reports/${report.id}`) });
  };

  const isLoading = teacherLoading || (!!teacher && (classesLoading || readinessResults.some((r) => r.isLoading)));
  const isError = classesError || readinessResults.some((r) => r.isError);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  // Distinct from the empty state below — a failed request otherwise renders as "no learners
  // eligible yet", which reads as a real (and wrong) answer rather than a problem to retry.
  if (isError) {
    return (
      <div style={{ ...cardStyle, padding: "16px 18px", margin: "8px 0", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#B91C1C", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
        Couldn't load report readiness — try refreshing the page.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Course Reports</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>
            Each session's report publishes automatically once its assessments are graded — no action needed. Once every session is ready, generate the course's final combined report card here, add remarks, then publish it for the learner and guardian to see.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiTile icon={<HourglassEmptyIcon fontSize="small" />} num={readyCount} label="Ready to generate" sub="Every assessment graded" />
        <KpiTile icon={<DescriptionIcon fontSize="small" />} num={draftCount} label="Drafts" sub="Awaiting your review" />
        <KpiTile icon={<CheckCircleIcon fontSize="small" />} num={publishedCount} label="Published" sub="Visible to learner & guardian" />
      </div>

      {sections.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No learners eligible yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Reports appear here once your classes' courses have at least one attached assessment.</p>
        </div>
      ) : (
        sections.map(({ cls, course, rows }) => (
          <CourseReportCard
            key={`${cls.id}:${course.id}`}
            cls={cls}
            course={course}
            rows={rows}
            onGenerate={handleGenerate}
            isGeneratingRow={isGeneratingRow}
            navigate={navigate}
          />
        ))
      )}
    </div>
  );
}
