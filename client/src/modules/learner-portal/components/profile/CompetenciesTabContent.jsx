import { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle } from "./theme";
import { iconFor } from "./competencyIcons";

function CompetencyRow({ competency, isOpen, onToggle }) {
  const Icon = iconFor(competency.name);
  const indicators = competency.indicators || [];

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: T.tintBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>{competency.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{indicators.length} indicator{indicators.length !== 1 ? "s" : ""} · Pass threshold {competency.minimumThreshold}%</p>
        </div>
        {isOpen ? <FiChevronUp size={16} color={T.inkFaint} /> : <FiChevronDown size={16} color={T.inkFaint} />}
      </button>

      {isOpen && (
        <div style={{ padding: "0 18px 18px 70px", display: "flex", flexDirection: "column", gap: 10 }}>
          {competency.description && (
            <p style={{ margin: "0 0 4px", fontSize: 13, color: T.inkMuted, lineHeight: 1.5 }}>{competency.description}</p>
          )}
          {indicators.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint }}>No indicators defined for this competency yet.</p>
          ) : (
            indicators.map((ind) => (
              <div key={ind.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: T.tintBorder, marginTop: 6, flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: T.ink }}>{ind.name}</p>
                  {ind.description && <p style={{ margin: "1px 0 0", fontSize: 12, color: T.inkMuted }}>{ind.description}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// The full competency taxonomy for this learner's curriculum — names, descriptions, and base
// indicators are real (from the global competency catalog). Per-learner mastery levels aren't
// wired up yet (see the Overview tab's Competency Progress grid, which stays "Preview" for that
// reason) — this tab is about what mastery looks like, not this learner's score against it.
export default function CompetenciesTabContent({ competencies, isLoading }) {
  const [openId, setOpenId] = useState(null);

  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <h2 style={{ ...sectionHeaderStyle(), marginBottom: 16 }}>Competency Framework</h2>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
      ) : (competencies || []).length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>
          No competencies adopted on this learner's curriculum yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {competencies.map((c) => (
            <CompetencyRow key={c.id} competency={c} isOpen={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
