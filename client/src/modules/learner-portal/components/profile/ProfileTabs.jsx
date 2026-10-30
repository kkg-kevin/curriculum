import { FiAward, FiBarChart2, FiClipboard, FiClock, FiCompass, FiHome, FiUsers } from "react-icons/fi";
import { T } from "./theme";

export const PROFILE_TABS = ["Overview", "Competencies", "Pathway", "Assessments", "Reports"];

// An icon for each tab, so a young learner can find their way by sight. A tab without one (a
// later addition) shows its name alone.
const TAB_ICON = { Overview: FiHome, Competencies: FiAward, Pathway: FiCompass, Assessments: FiClipboard, Reports: FiBarChart2, Parent: FiUsers, History: FiClock };

// Big, rounded pill buttons — easy to tap on a tablet or phone. The chosen one is filled.
export default function ProfileTabs({ active, onChange, tabs = PROFILE_TABS }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 2px 6px" }}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        const Icon = TAB_ICON[tab];
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 18px",
              borderRadius: 999,
              border: `2px solid ${isActive ? T.accentMid : T.border}`,
              background: isActive ? `linear-gradient(135deg, ${T.accentMid}, ${T.accentLight})` : "#fff",
              color: isActive ? "#fff" : T.ink,
              boxShadow: isActive ? "0 6px 14px rgba(46, 125, 181, 0.28)" : "0 2px 6px rgba(37, 71, 106, 0.05)",
              fontWeight: 800,
              fontSize: 14.5,
              fontFamily: "inherit",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "transform 120ms ease, box-shadow 120ms ease",
            }}
          >
            {Icon && <Icon aria-hidden="true" size={16} strokeWidth={2.4} />}
            {tab}
          </button>
        );
      })}
    </div>
  );
}
