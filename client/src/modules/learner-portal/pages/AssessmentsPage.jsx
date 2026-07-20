import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { courseApi } from "../../courses/services/courseApi";
import { getProgressSummary } from "../utils/progressStorage";

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

function cardStyle() {
  return {
    backgroundColor: "#fff",
    borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: `1px solid ${T.border}`,
  };
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function KpiTile({ icon, value, label, sub }) {
  return (
    <div style={{ ...cardStyle(), padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: T.accent, lineHeight: 1 }}>{value}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>{label}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkFaint }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function LearnerAssessmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: learnersData, isLoading: learnerLoading } = useQuery({
    queryKey: ["learners", "byGuardianEmail", user?.email],
    queryFn: () => learnerApi.getAll({ guardianEmail: user.email }),
    enabled: !!user?.email,
  });
  const learner = learnersData?.data?.[0] || null;

  const { data: cls, isLoading: classLoading } = useQuery({
    queryKey: ["classes", "detail", learner?.classId],
    queryFn: () => classApi.getById(learner.classId),
    enabled: !!learner?.classId,
  });

  const { data: courses = [], isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeName);

  const courseProgress = useMemo(() => getProgressSummary(user?.email), [user?.email]);

  const assessments = useMemo(() => {
    return (courses || []).map((course) => ({
      id: `${course.id}-assessment`,
      title: `${course.name} practice check`,
      courseName: course.name,
      due: "Upcoming",
      status: courseProgress.started > 0 ? "In progress" : "Assigned",
      description: `Review the current lessons in ${course.name} and prepare for a short class check-in.`,
    }));
  }, [courses, courseProgress.started]);

  const isLoading = learnerLoading || (!!learner && classLoading) || coursesLoading;

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>;
  }

  if (!learner) {
    return (
      <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No learner profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask your school to connect your account to a learner record.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>My Assessments</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>Review the assessments and checks that are linked to your current courses.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiTile icon="📝" value={assessments.length} label="Assigned checks" sub={`${courseProgress.started} course${courseProgress.started === 1 ? "" : "s"} started`} />
        <KpiTile icon="✅" value={courseProgress.completed} label="Completed" sub="Marked complete in your learning progress" />
        <KpiTile icon="⏳" value={Math.max(assessments.length - courseProgress.completed, 0)} label="Pending" sub="Ready to review" />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => navigate("/learner-portal/courses")} style={{ padding: "10px 18px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Browse courses</button>
        <button type="button" onClick={() => navigate("/learner-portal/progress")} style={{ padding: "10px 18px", backgroundColor: "#FFFBEB", color: "#B45309", border: "1.5px solid #FDE68A", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>View progress</button>
      </div>

      {assessments.length === 0 ? (
        <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No assessments yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Your teacher will add assessments here once they’re linked to your courses.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {assessments.map((item) => (
            <div key={item.id} style={{ ...cardStyle(), padding: "18px 20px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>{item.title}</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: T.inkMuted }}>{item.description}</p>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: T.accent, fontWeight: 600 }}>{item.courseName} · Due {item.due}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.status === "In progress" ? "#B45309" : T.accent, backgroundColor: item.status === "In progress" ? "#FEF3C7" : T.tintBg, borderRadius: 999, padding: "6px 10px" }}>{item.status}</span>
                <button type="button" onClick={() => navigate(`/learner-portal/courses/${courses.find((c) => c.name === item.courseName)?.id || ""}`)} style={{ padding: "8px 12px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open course</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
