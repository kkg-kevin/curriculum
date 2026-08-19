import { useNavigate, useParams } from "react-router-dom";
import { FiAlertTriangle } from "react-icons/fi";
import { useCourseQuery, useSessions, useCourseLearningAreas } from "../hooks/useCourse";
import { sessionLabel } from "../sectionConfig";
import { useAuth } from "../../../context/AuthContext";
import { courseCatalogPath, sectionPath } from "../../../routes/portalPaths";

const ACCENT = "#25476a";

// Read-only landing page for a single course, reached from a School's/Teacher's/Learner's
// course catalog. Deliberately not CourseViewPage (that page is a session editor with
// create/update/delete — appropriate for Admin authoring, not for browsing content) — but the
// Learning Area tags CourseViewPage shows are still pulled in here read-only (no "Add some →"
// edit prompt, since this page has no admin controls), so a course tagged e.g. "Robotics" reads
// the same regardless of who's looking at it, not just to Admin.
export default function CourseContentLandingPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;

  const { data: course, isLoading: courseLoading } = useCourseQuery(courseId);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(courseId);
  const { data: learningAreas = [] } = useCourseLearningAreas(courseId);

  if (courseLoading || sessionsLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }
  if (!course) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px", display: "flex", alignItems: "center", gap: 8 }}>
        <FiAlertTriangle size={15} /> Course not found.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <button
        type="button"
        onClick={() => navigate(courseCatalogPath(role))}
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", marginBottom: "16px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "20px", color: "#374151", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
      >
        ← My Courses
      </button>

      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#ffffff" }}>{course.name}</h1>
          <p style={{ margin: learningAreas.length > 0 ? "0 0 12px" : 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 640 }}>
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
          {learningAreas.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {learningAreas.map((area) => (
                <span
                  key={area.id}
                  style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                    backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#ffffff",
                  }}
                >
                  {area.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#9CA3AF" }}>No sessions have been added to this course yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.map((session, idx) => (
            <div
              key={session.id}
              onClick={() => navigate(sectionPath(role, courseId, session.id, "outcomes"))}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", backgroundColor: "#fff", borderRadius: 14, border: "1.5px solid #E5E7EB", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "#a8d5ee"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
            >
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>{sessionLabel(session, idx)}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                  {(session.outcomes?.length ?? 0)} learning outcome{(session.outcomes?.length ?? 0) !== 1 ? "s" : ""}
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>Open →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
