import { T } from "./theme";

export const PROFILE_TABS = ["Overview", "Competencies", "Learning Journey", "Evidence Portfolio", "Assessments", "Badges", "Timeline"];

export default function ProfileTabs({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, overflowX: "auto" }}>
      {PROFILE_TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: `2.5px solid ${isActive ? T.accent : "transparent"}`,
              color: isActive ? T.accent : T.inkMuted,
              fontWeight: isActive ? 700 : 500,
              fontSize: 13.5,
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
