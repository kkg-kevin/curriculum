import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { T, cardStyle, sectionHeaderStyle } from "./theme";
import { getCourseCompletionPercent } from "../../utils/progressStorage";

const SUB_TABS = ["active", "upcoming", "completed"];
const SUB_TAB_LABELS = { active: "Active", upcoming: "Upcoming", completed: "Completed" };

export default function LearningJourneyCard({ courses, email, isLoading }) {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState("active");

  const withProgress = useMemo(
    () => (courses || []).map((c) => ({ ...c, percent: getCourseCompletionPercent(email, c.id, c.sessionCount ?? 0) })),
    [courses, email]
  );

  const buckets = useMemo(() => ({
    active:    withProgress.filter((c) => c.percent > 0 && c.percent < 100),
    upcoming:  withProgress.filter((c) => c.percent === 0),
    completed: withProgress.filter((c) => c.percent === 100),
  }), [withProgress]);

  const visible = buckets[subTab];

  return (
    <div style={{ ...cardStyle(), padding: 20, flex: 1, minWidth: 260, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={sectionHeaderStyle()}>My Learning Journey</h2>
        <button
          type="button"
          onClick={() => navigate("/learner-portal/courses")}
          style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
        >
          View all courses
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {SUB_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            style={{
              padding: "5px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif",
              border: `1px solid ${subTab === t ? T.accent : T.border}`,
              backgroundColor: subTab === t ? T.tintBg : "transparent",
              color: subTab === t ? T.accent : T.inkMuted, cursor: "pointer",
            }}
          >
            {SUB_TAB_LABELS[t]} ({buckets[t].length})
          </button>
        ))}
      </div>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Nothing here yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.slice(0, 3).map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/learner-portal/courses/${c.id}`)}
              style={{ display: "flex", gap: 10, cursor: "pointer" }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: T.tintBg, flexShrink: 0, overflow: "hidden" }}>
                {c.coverImage && <img src={c.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</p>
                <p style={{ margin: "0 0 6px", fontSize: 11, color: T.inkMuted }}>{c.sessionCount ?? 0} session{(c.sessionCount ?? 0) !== 1 ? "s" : ""}</p>
                <div style={{ height: 5, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
                  <div style={{ width: `${c.percent}%`, height: "100%", backgroundColor: T.accentMid }} />
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, flexShrink: 0 }}>{c.percent}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
