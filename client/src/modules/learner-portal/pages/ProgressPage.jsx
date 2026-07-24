import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiClipboard, FiTrendingUp } from "react-icons/fi";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { useCurrentLearner } from "../hooks/useCurrentLearner";
import { summarizeCoursesProgress } from "../utils/progressStorage";
import SideRail from "../components/SideRail";

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
  return { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` };
}

function StatTile({ icon, value, label }) {
  return (
    <div style={{ ...cardStyle(), padding: "18px 20px", display: "flex", gap: 14, alignItems: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.tintBg, display: "grid", placeItems: "center", color: T.accent, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: T.accent }}>{value}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>{label}</p>
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  completed:   { label: "Completed",   bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
  in_progress: { label: "In Progress", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  not_started: { label: "Not Started", bg: "#F9FAFB", color: T.inkMuted, border: T.border },
};

function statusOf(percent) {
  if (percent === 100) return "completed";
  if (percent > 0) return "in_progress";
  return "not_started";
}

export default function LearnerProgressPage() {
  const navigate = useNavigate();
  const { user, learner, isLoading, hubs, hubsLoading, cls, mentors, mentorsLoading } = useCurrentLearner();
  const { data: courses, isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeName);

  const summary = useMemo(() => summarizeCoursesProgress(user?.email, courses), [courses, user?.email]);

  if (isLoading || coursesLoading) {
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
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>My Progress</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>How far you've actually gotten through each course — based on the lessons you've opened.</p>
        </div>
      </div>

      {!cls?.curriculumId ? (
        <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No curriculum assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Your school hasn't been assigned a curriculum yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 2, minWidth: 340 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <StatTile icon={<FiTrendingUp />} value={`${summary.percent}%`} label="Average completion" />
              <StatTile icon={<FiCheckCircle />} value={summary.completed} label="Completed courses" />
              <StatTile icon={<FiClipboard />} value={summary.inProgress} label="In progress" />
            </div>

            {summary.courses.length === 0 ? (
              <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No courses yet</h3>
                <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Your courses will appear here once your class is assigned a curriculum.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {summary.courses.map((course) => {
                  const status = statusOf(course.percent);
                  const cfg = STATUS_CONFIG[status];
                  return (
                    <div key={course.id} style={{ ...cardStyle(), padding: 20, display: "flex", alignItems: "center", gap: 18 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: T.tintBg, flexShrink: 0, overflow: "hidden" }}>
                        {course.coverImage && <img src={course.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink }}>{course.name}</p>
                          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, backgroundColor: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 999, padding: "3px 10px" }}>{cfg.label}</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 5, backgroundColor: "#F3F4F6", overflow: "hidden", maxWidth: 420 }}>
                          <div style={{ width: `${course.percent}%`, height: "100%", backgroundColor: T.accentMid }} />
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: T.accent }}>{course.percent}%</p>
                        <button
                          type="button"
                          onClick={() => navigate(`/learner-portal/courses/${course.id}`)}
                          style={{ padding: "8px 16px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                        >
                          {status === "not_started" ? "Start" : status === "completed" ? "Review" : "Resume"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <SideRail hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={mentorsLoading} />
          </div>
        </div>
      )}
    </div>
  );
}
