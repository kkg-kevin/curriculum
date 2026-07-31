import { useState, useMemo } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle } from "./theme";
import { iconFor } from "./competencyIcons";
import { useLearnerIndicatorProgress } from "../../../assessments/hooks/useAssessmentSubmission";
import { useLearnerCompetencyScores, useLearnerBandProgress } from "../../../curriculum/hooks/useCompetencies";

// percent is null (renders "Not yet scored") until the curriculum's Assessment Types have real
// competencyMappings configured on their Score Evidence panel (Engine 2 has nothing to
// distribute yet) — that's a real, honest state, not a bug, so it's shown rather than hidden.
function ProgressBadge({ percent }) {
  const color = percent == null ? T.inkFaint : percent >= 60 ? "#059669" : "#DC2626";
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color, backgroundColor: percent == null ? "transparent" : `${color}12`, border: percent == null ? "none" : `1px solid ${color}35`, borderRadius: 20, padding: percent == null ? 0 : "2px 9px", whiteSpace: "nowrap", flexShrink: 0 }}>
      {percent == null ? "Not yet scored" : `${percent}%`}
    </span>
  );
}

function BandBadge({ scoreEntry }) {
  if (!scoreEntry?.band) return null;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: T.accent, backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
      {scoreEntry.band.name}
    </span>
  );
}

function CompetencyRow({ competency, isOpen, onToggle, progressByIndicator, scoreEntry }) {
  const Icon = iconFor(competency.name);
  const indicators = competency.indicators || [];
  // The curriculum's own weighted score (Evidence Type → Assessment Type → scoring engines,
  // configured on the curriculum's Score Evidence panel) — the only source of truth for this
  // header percent. Per-indicator raw marks are still shown below when expanded, but must never
  // be averaged back into an overall percent here — that bypasses the curriculum's weighting.
  const overallPercent = scoreEntry?.score ?? null;

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
        <BandBadge scoreEntry={scoreEntry} />
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

// Engine 4 — how much of each Performance Band's 100% this learner has actually completed
// (indicator-achievement-weighted, independent of which band a competency's raw score currently
// falls into via BandBadge above). Curriculum-wide bands, not per-competency — same list the
// admin's own Performance Bands panel shows, just computed for this one learner.
function BandProgressSection({ curriculumId, learnerId }) {
  const { data: bandProgress = [] } = useLearnerBandProgress(curriculumId, learnerId);
  if (bandProgress.length === 0) return null;

  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <h2 style={{ ...sectionHeaderStyle(), marginBottom: 16 }}>Band Progress</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {bandProgress.map((bp) => (
          <div key={bp.bandId}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
                {bp.name}
                {bp.thresholdMet && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 20, padding: "1px 8px" }}>
                    Threshold met
                  </span>
                )}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{bp.completion}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, bp.completion)}%`, height: "100%", backgroundColor: bp.thresholdMet ? "#059669" : T.tintBorder }} />
            </div>
          </div>
        ))}
      </div>
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
export default function CompetenciesTabContent({ competencies, isLoading, learnerId, curriculumId }) {
  const [openId, setOpenId] = useState(null);
  const { data: progressRows = [] } = useLearnerIndicatorProgress(learnerId, curriculumId);
  const progressByIndicator = useMemo(() => new Map(progressRows.map((r) => [r.indicatorId, r])), [progressRows]);

  const { data: scoreRows = [] } = useLearnerCompetencyScores(curriculumId, learnerId);
  const scoreByCompetencyId = useMemo(() => new Map(scoreRows.map((r) => [r.competencyId, r])), [scoreRows]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BandProgressSection curriculumId={curriculumId} learnerId={learnerId} />

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
              <CompetencyRow key={c.id} competency={c} isOpen={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} progressByIndicator={progressByIndicator} scoreEntry={scoreByCompetencyId.get(c.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
