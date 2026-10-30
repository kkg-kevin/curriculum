import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, KID, KidHeading, T, cardStyle } from "./theme";
import { getCourseCompletionPercent } from "../../utils/progressStorage";
import { FiBookOpen } from "react-icons/fi";

const SUB_TABS = ["active", "upcoming", "completed"];
const SUB_TAB_LABELS = { active: "Active", upcoming: "Upcoming", completed: "Completed" };

export default function MyCoursesCard({ courses, email, isLoading }) {
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
      <KidHeading icon={FiBookOpen} tone={KID.sky} action={
        <button
          type="button"
          onClick={() => navigate("/learner-portal/courses")}
          style={{ background: KID.sky.soft, border: `1.5px solid ${KID.sky.border}`, borderRadius: 999, padding: "6px 12px", color: KID.sky.color, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
        >
          All courses →
        </button>
      }>My Courses</KidHeading>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {SUB_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            style={{
              padding: "7px 13px", borderRadius: 999, fontSize: 13, fontWeight: 800, fontFamily: "inherit",
              border: `2px solid ${subTab === t ? KID.sky.color : T.border}`,
              backgroundColor: subTab === t ? KID.sky.color : "#fff",
              color: subTab === t ? "#fff" : T.inkMuted, cursor: "pointer",
            }}
          >
            {SUB_TAB_LABELS[t]} ({buckets[t].length})
          </button>
        ))}
      </div>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
      ) : visible.length === 0 ? (
        <EmptyState icon={FiBookOpen}>Nothing here yet.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.slice(0, 3).map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/learner-portal/courses/${c.id}`)}
              style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer", padding: 10, borderRadius: 16, backgroundColor: "#F8FAFD", border: `1.5px solid ${T.border}` }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: KID.sky.soft, flexShrink: 0, overflow: "hidden" }}>
                {c.coverImage && <img src={c.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</p>
                <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 600, color: T.inkMuted }}>{c.sessionCount ?? 0} session{(c.sessionCount ?? 0) !== 1 ? "s" : ""}</p>
                <div style={{ height: 9, borderRadius: 999, backgroundColor: "#E8EEF6", overflow: "hidden" }}>
                  <div style={{ width: `${c.percent}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${KID.navy.fill}, ${KID.sky.fill})` }} />
                </div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 900, color: KID.sky.color, flexShrink: 0 }}>{c.percent}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
