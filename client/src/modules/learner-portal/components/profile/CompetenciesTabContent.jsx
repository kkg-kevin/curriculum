import { useState, useMemo } from "react";
import { FiChevronDown, FiChevronUp, FiGrid, FiStar } from "react-icons/fi";
import { T, cardStyle, KID, KidHeading, EmptyState } from "./theme";
import { iconFor } from "./competencyIcons";
import { useLearnerIndicatorProgress } from "../../../assessments/hooks/useAssessmentSubmission";
import { useLearnerCompetencyScores } from "../../../curriculum/hooks/useCompetencies";
import ProgressArcCard from "../ProgressArcCard";

// percent is null (renders "Not yet scored") until the curriculum's Assessment Types have real
// competencyMappings configured on their Score Evidence panel (Engine 2 has nothing to
// distribute yet) — that's a real, honest state, not a bug, so it's shown rather than hidden.
// Below the bar reads as "keep going" (sunny), never as a red failure, for a young learner.
function ProgressBadge({ percent }) {
  const tone = percent == null ? null : percent >= 60 ? KID.sky : KID.gold;
  return (
    <span style={{ fontSize: percent == null ? 12.5 : 14, fontWeight: 900, color: tone ? tone.color : T.inkFaint, backgroundColor: tone ? tone.soft : "transparent", border: tone ? `1.5px solid ${tone.border}` : "none", borderRadius: 999, padding: tone ? "3px 11px" : 0, whiteSpace: "nowrap", flexShrink: 0 }}>
      {percent == null ? "Not started yet" : `${percent}%`}
    </span>
  );
}

function BandBadge({ scoreEntry }) {
  if (!scoreEntry?.band) return null;
  return (
    <span style={{ fontSize: 12, fontWeight: 800, color: KID.navy.color, backgroundColor: "#fff", border: `1.5px solid ${KID.navy.border}`, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>
      <FiStar size={11} strokeWidth={2.6} style={{ verticalAlign: "-1px", marginRight: 3 }} />{scoreEntry.band.name}
    </span>
  );
}

const ROW_TONES = [KID.sky, KID.navy, KID.gold];

function CompetencyRow({ competency, index = 0, isOpen, onToggle, progressByIndicator, scoreEntry }) {
  const tone = ROW_TONES[index % ROW_TONES.length];
  const Icon = iconFor(competency.name);
  const indicators = competency.indicators || [];
  // The curriculum's own weighted score (Evidence Type → Assessment Type → scoring engines,
  // configured on the curriculum's Score Evidence panel) — the only source of truth for this
  // header percent. Per-indicator raw marks are still shown below when expanded, but must never
  // be averaged back into an overall percent here — that bypasses the curriculum's weighting.
  const overallPercent = scoreEntry?.score ?? null;

  return (
    <div style={{ border: `1.5px solid ${isOpen ? tone.border : T.border}`, borderRadius: 18, overflow: "hidden", backgroundColor: isOpen ? tone.soft : "#fff" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tone.soft, border: `1.5px solid ${tone.border}`, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: T.ink }}>{competency.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: T.inkMuted }}>{indicators.length} indicator{indicators.length !== 1 ? "s" : ""} · Pass threshold {competency.minimumThreshold}%</p>
        </div>
        <BandBadge scoreEntry={scoreEntry} />
        <ProgressBadge percent={overallPercent} />
        {isOpen ? <FiChevronUp size={16} color={T.inkFaint} /> : <FiChevronDown size={16} color={T.inkFaint} />}
      </button>

      {isOpen && (
        <div style={{ padding: "0 18px 18px 76px", display: "flex", flexDirection: "column", gap: 10 }}>
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
                  <div style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: tone.color, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>{ind.name}</p>
                      {ind.description && <p style={{ margin: "1px 0 0", fontSize: 12, color: T.inkMuted }}>{ind.description}</p>}
                    </div>
                    {percent != null && (
                      <span style={{ fontSize: 13, fontWeight: 800, color: tone.color, whiteSpace: "nowrap", flexShrink: 0 }}>
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
// indicators are real (from the global competency catalog). Each competency's headline percent
// (CompetencyRow's ProgressBadge/BandBadge) is the curriculum's own weighted score — computed
// server-side from this learner's graded work via the curriculum's configured Evidence Weights
// → Assessment Type Weights → scoring engines (see competency.service.js). The raw per-indicator
// marks fetched below are shown only in each row's expanded detail, never averaged into the
// headline percent — that would bypass the curriculum's configured weighting.
export default function CompetenciesTabContent({ competencies, isLoading, learnerId, curriculumId, hubId }) {
  const [openId, setOpenId] = useState(null);
  const { data: progressRows = [] } = useLearnerIndicatorProgress(learnerId, curriculumId);
  const progressByIndicator = useMemo(() => new Map(progressRows.map((r) => [r.indicatorId, r])), [progressRows]);

  const { data: scoreRows = [] } = useLearnerCompetencyScores(curriculumId, learnerId, hubId);
  const scoreByCompetencyId = useMemo(() => new Map(scoreRows.map((r) => [r.competencyId, r])), [scoreRows]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ProgressArcCard curriculumId={curriculumId} learnerId={learnerId} hubId={hubId} />

      <div style={{ ...cardStyle(), padding: 20 }}>
        <KidHeading icon={FiGrid} tone={KID.navy} sub="Tap a skill to see how each part of it is going.">Competency Framework</KidHeading>

        {isLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
        ) : (competencies || []).length === 0 ? (
          <EmptyState icon={FiGrid}>No skills to show yet — they appear once your curriculum adds them.</EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {competencies.map((c, i) => (
              <CompetencyRow key={c.id} index={i} competency={c} isOpen={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} progressByIndicator={progressByIndicator} scoreEntry={scoreByCompetencyId.get(c.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
