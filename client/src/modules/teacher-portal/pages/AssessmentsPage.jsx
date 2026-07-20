import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { teacherApi } from "../../teachers/services/teacherApi";
import { locationApi as schoolApi } from "../../locations/services/locationApi";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCurrentCoursesForGrades } from "../../curriculum/hooks/useCurriculumVersion";
import { courseApi } from "../../courses/services/courseApi";
import { sectionPath } from "../../../routes/portalPaths";

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

function AssessmentCard({ item, onOpen }) {
  const color = TYPE_COLORS[item.type] || T.accentLight;
  const modeColor = MODE_COLORS[item.mode] || T.inkMuted;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        ...cardStyle,
        width: "100%",
        padding: "18px 20px",
        border: "1px solid transparent",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${T.accentDeep}, ${T.accentMid})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20, color: "#fff" }}>
          {item.type === "quiz" ? "📝" : item.type === "exam" ? "🎓" : item.type === "project" ? "🛠️" : item.type === "assignment" ? "📄" : "👁️"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </h3>
          <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted }}>
            {item.courseName} · {item.sessionLabel}
          </p>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: T.inkMuted, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {stripHtml(item.description) || "No description added"}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span style={badgeStyle(color)}>{TYPE_LABELS[item.type] || item.type}</span>
        <span style={badgeStyle(modeColor)}>{MODE_LABELS[item.mode] || "Individual"}</span>
        <span style={badgeStyle(T.accent)}>{assessmentSummary(item)}</span>
      </div>
    </button>
  );
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: teachersData, isLoading: teacherLoading } = useQuery({
    queryKey: ["teachers", "byEmail", user?.email],
    queryFn: () => teacherApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const teacher = teachersData?.data?.[0] || null;

  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ["schools", "detail", teacher?.schoolId],
    queryFn: () => schoolApi.getById(teacher.schoolId),
    enabled: !!teacher?.schoolId,
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", teacher?.schoolId],
    queryFn: () => classApi.getAll({ schoolId: teacher.schoolId }),
    enabled: !!teacher?.schoolId,
  });
  const myClasses = (classesData?.data || []).filter((c) => c.classTeacherId === teacher?.id);
  const gradeNames = [...new Set(myClasses.map((c) => c.gradeName))];

  const { data: courses = [], isLoading: coursesLoading } = useCurriculumCurrentCoursesForGrades(school?.curriculumId, gradeNames);

  const sessionsResults = useQueries({
    queries: courses.map((course) => ({
      queryKey: ["teacher-portal", "course-sessions", course.id],
      queryFn: () => courseApi.getSessions(course.id),
      enabled: !!course.id,
    })),
  });

  const attachments = useMemo(() => {
    const rows = [];
    sessionsResults.forEach((result, index) => {
      const course = courses[index];
      (result.data || []).forEach((session) => {
        (session.attachedAssessments || []).forEach((assessment) => {
          rows.push({
            ...assessment,
            courseId: course.id,
            courseName: course.name,
            sessionId: session.id,
            sessionLabel: session.title?.trim() || `Session ${session.order || 1}`,
          });
        });
      });
    });
    return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [courses, sessionsResults]);

  const isLoading = teacherLoading || (!!teacher && (schoolLoading || classesLoading || coursesLoading || sessionsResults.some((r) => r.isLoading)));

  const totalCount = attachments.length;
  const individualCount = attachments.filter((a) => a.mode === "individual").length;
  const groupCount = attachments.filter((a) => a.mode === "group").length;
  const courseCount = new Set(attachments.map((a) => a.courseId)).size;

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading...</div>;
  }

  if (!teacher) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No teacher profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask your school admin to add you as a teacher using this same email address.</p>
      </div>
    );
  }

  if (!school?.curriculumId) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No curriculum assigned yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Your school hasn't been assigned a curriculum yet.</p>
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
            Assessments attached to your assigned classes and course content. Open any item to jump straight to the session where it lives.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiTile icon="📋" num={totalCount} label="Attachments" sub={`${courseCount} course${courseCount === 1 ? "" : "s"} involved`} />
        <KpiTile icon="👤" num={individualCount} label="Individual" sub="Teacher-marked or learner work" />
        <KpiTile icon="👥" num={groupCount} label="Group" sub="Shared activities or group tasks" />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => navigate("/teacher-portal/course-content")}
          style={{ padding: "10px 18px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          Browse course content
        </button>
        <button
          type="button"
          onClick={() => navigate("/teacher-portal/attendance")}
          style={{ padding: "10px 18px", backgroundColor: "#FFFBEB", color: "#B45309", border: "1.5px solid #FDE68A", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          Attendance
        </button>
      </div>

      {attachments.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No assessments attached yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Once your school adds assessments to your class courses, they will show up here automatically.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {attachments.map((item) => (
            <AssessmentCard
              key={`${item.courseId}:${item.sessionId}:${item.id}`}
              item={item}
              onOpen={() => navigate(sectionPath("teacher", item.courseId, item.sessionId, "assessments", item.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
