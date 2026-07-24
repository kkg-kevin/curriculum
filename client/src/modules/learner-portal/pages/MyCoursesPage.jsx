import { useMemo } from "react";
import { FiBookOpen, FiCheckCircle, FiPlayCircle } from "react-icons/fi";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import CourseCatalogGrid from "../../courses/components/CourseCatalogGrid";
import { useCurrentLearner } from "../hooks/useCurrentLearner";
import { getCourseCompletionPercent } from "../utils/progressStorage";
import SideRail from "../components/SideRail";

const T = {
  accent: "#25476a",
  accentDeep: "#1a3550",
  accentMid: "#2e7db5",
  accentLight: "#38aae1",
  tintBg: "#e8f5fb",
  ink: "#111827",
  inkMuted: "#6B7280",
  inkFaint: "#9CA3AF",
  border: "#E5E7EB",
};

function cardStyle() {
  return { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` };
}

function StatTile({ icon, value, label }) {
  return (
    <div style={{ ...cardStyle(), padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.tintBg, display: "grid", placeItems: "center", color: T.accent, flexShrink: 0 }}>{icon}</div>
      <div><p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.accent }}>{value}</p><p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>{label}</p></div>
    </div>
  );
}

export default function MyCoursesPage() {
  const { user, learner, isLoading, hubs, hubsLoading, cls, mentors, mentorsLoading } = useCurrentLearner();
  const { data: courses, isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeName);

  const stats = useMemo(() => {
    const withProgress = (courses || []).map((c) => getCourseCompletionPercent(user?.email, c.id, c.sessionCount ?? 0));
    return {
      total: withProgress.length,
      completed: withProgress.filter((p) => p === 100).length,
      inProgress: withProgress.filter((p) => p > 0 && p < 100).length,
    };
  }, [courses, user?.email]);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px" }}>
            My Courses
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", maxWidth: "560px" }}>
            Browse the courses your class is following this year.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !learner ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No learner profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Ask your school to record this same email address as your guardian email.</p>
        </div>
      ) : !cls?.curriculumId ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No curriculum assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Your school hasn't been assigned a curriculum yet.</p>
        </div>
      ) : coursesLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 2, minWidth: 340 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <StatTile icon={<FiBookOpen size={18} />} value={stats.total} label="Courses enrolled" />
              <StatTile icon={<FiPlayCircle size={18} />} value={stats.inProgress} label="In progress" />
              <StatTile icon={<FiCheckCircle size={18} />} value={stats.completed} label="Completed" />
            </div>
            <CourseCatalogGrid role="learner" courses={courses || []} />
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <SideRail hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={mentorsLoading} />
          </div>
        </div>
      )}
    </div>
  );
}
