import { useState, useMemo } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle } from "./theme";
import { iconFor } from "./competencyIcons";
import { useLearnerIndicatorProgress } from "../../../assessments/hooks/useAssessmentSubmission";
import { competencyPercent } from "../../utils/competencyProgress";

function ProgressBadge({ percent }) {
  if (percent == null) return null;
  const color = percent >= 60 ? "#059669" : "#DC2626";
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color, backgroundColor: `${color}12`, border: `1px solid ${color}35`, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap", flexShrink: 0 }}>
      {percent}%
    </span>
  );
}

function CompetencyRow({ competency, isOpen, onToggle, progressByIndicator }) {
  const Icon = iconFor(competency.name);
  const indicators = competency.indicators || [];
  const overallPercent = competencyPercent(indicators, progressByIndicator);

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
        <ProgressBadge percent={overallPercent} />
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
            indicators.map((ind) => {
              const progress = progressByIndicator.get(ind.id);
              const percent = progress?.marksPossible > 0 ? Math.round((progress.marksEarned / progress.marksPossible) * 100) : null;
              return (
                <div key={ind.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: T.tintBorder, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: T.ink }}>{ind.name}</p>
                      {ind.description && <p style={{ margin: "1px 0 0", fontSize: 12, color: T.inkMuted }}>{ind.description}</p>}
                    </div>
                    {percent != null && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: T.inkMuted, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {progress.marksEarned}/{progress.marksPossible} · {percent}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// The full competency taxonomy for this learner's curriculum — names, descriptions, and base
// indicators are real (from the global competency catalog), each now paired with this
// learner's real accumulating progress: marks earned vs. possible per indicator, summed across
// every graded assessment that tagged it (see server's getLearnerIndicatorProgress) — a
// competency/indicator with no attempts yet simply shows no percent.
export default function CompetenciesTabContent({ competencies, isLoading, learnerId }) {
  const [openId, setOpenId] = useState(null);
  const { data: progressRows = [] } = useLearnerIndicatorProgress(learnerId);
  const progressByIndicator = useMemo(() => new Map(progressRows.map((r) => [r.indicatorId, r])), [progressRows]);

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
            <CompetencyRow key={c.id} competency={c} isOpen={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} progressByIndicator={progressByIndicator} />
          ))}
        </div>
      )}
    </div>
  );
}
