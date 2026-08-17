import { useState, useMemo } from "react";
import { FiChevronDown, FiChevronUp, FiCheck } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle } from "./theme";
import { iconFor } from "./competencyIcons";
import { useLearnerIndicatorProgress } from "../../../assessments/hooks/useAssessmentSubmission";
import { useLearnerCompetencyScores, useLearnerBandProgress } from "../../../curriculum/hooks/useCompetencies";
import { deriveBandJourney } from "../../utils/bandJourney";

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

// Circular percent ring for the node the learner is actively working toward — plain SVG rather
// than pulling in Recharts for one shape, consistent with this module having no chart lib usage
// elsewhere.
function ProgressRing({ percent, size = 54, stroke = 5, color }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}

function LevelNode({ band, status, size = 54 }) {
  const achieved = status === "achieved";
  const current = status === "current";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 84 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        {current && <ProgressRing percent={band.completion} size={size} color={T.gold} />}
        <div
          style={{
            position: "absolute", inset: current ? 7 : 0, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: achieved ? "#059669" : current ? T.tintBg : "#fff",
            border: achieved ? "none" : current ? `1px solid ${T.tintBorder}` : `1.5px dashed ${T.border}`,
            color: achieved ? "#fff" : current ? T.accent : T.inkFaint,
            fontSize: 12.5, fontWeight: 800,
          }}
        >
          {achieved ? <FiCheck size={18} /> : current ? `${Math.round(band.completion)}%` : ""}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: achieved || current ? T.ink : T.inkFaint }}>{band.name}</p>
        <p style={{ margin: "1px 0 0", fontSize: 10.5, color: T.inkFaint }}>
          {achieved ? "Achieved" : current ? "In progress" : "Locked"}
        </p>
      </div>
    </div>
  );
}

// Connecting segment between two nodes: solid once the band it leads FROM is achieved, partially
// filled (matching that band's own completion%) while the learner is actively working through
// it, empty for anything still ahead of that.
function LevelConnector({ status, percent }) {
  const fillPercent = status === "achieved" ? 100 : status === "current" ? percent : 0;
  return (
    <div style={{ flex: 1, minWidth: 24, height: 4, borderRadius: 2, backgroundColor: "#F3F4F6", overflow: "hidden", marginTop: 27 }}>
      <div style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%`, height: "100%", backgroundColor: status === "achieved" ? "#059669" : T.gold }} />
    </div>
  );
}

function levelJourneyCaption(current, next) {
  if (next) return `You're at ${current ? current.name : "the start"} — ${next.completion}% of the way to ${next.name}.`;
  if (current) return `${current.name} — the highest level on this curriculum's ladder. Well done!`;
  return "Complete graded work tagged to these levels to start your journey.";
}

// Engine 4 — how much of each Performance Band's 100% this learner has actually completed
// (indicator-achievement-weighted, independent of which band a competency's raw score currently
// falls into via BandBadge above). Curriculum-wide bands, not per-competency — same list the
// admin's own Performance Bands panel shows, just computed for this one learner. Rendered as a
// left-to-right "journey" ladder (LevelNode + LevelConnector) rather than a flat list of progress
// bars, so it reads as a game-style level track: achieved levels solid, the level currently being
// worked toward highlighted with its own completion ring, everything after that shown locked.
function BandProgressSection({ curriculumId, learnerId }) {
  const { data: bandProgress = [] } = useLearnerBandProgress(curriculumId, learnerId);
  const { current, next } = useMemo(() => deriveBandJourney(bandProgress), [bandProgress]);
  if (bandProgress.length === 0) return null;

  // Only worth surfacing while it's actually true — a band with no configured threshold can
  // still show "Achieved" by reaching 100% completion (see runIndicatorProgressEngine), so once
  // anything has, this note would flatly contradict what the ladder above it just showed.
  const noThresholdsConfigured = bandProgress.every((bp) => !bp.advancementThreshold || bp.advancementThreshold <= 0);
  const nothingAchievedYet = !bandProgress.some((bp) => bp.thresholdMet);

  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <h2 style={{ ...sectionHeaderStyle(), marginBottom: 10 }}>Level Journey</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: T.inkMuted, lineHeight: 1.5 }}>{levelJourneyCaption(current, next)}</p>

      <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", paddingBottom: 4 }}>
        {bandProgress.map((bp, i) => {
          // Not positional — achieved/current are keyed off the real per-band signal (thresholdMet,
          // and "closest to done" from deriveBandJourney), since bands aren't guaranteed to be
          // cleared in left-to-right order. See bandJourney.js for why.
          const status = bp.thresholdMet ? "achieved" : bp.bandId === next?.bandId ? "current" : "locked";
          return (
            <div key={bp.bandId} style={{ display: "flex", alignItems: "flex-start", flex: i === bandProgress.length - 1 ? "0 0 auto" : 1 }}>
              <LevelNode band={bp} status={status} />
              {i < bandProgress.length - 1 && <LevelConnector status={status} percent={bp.completion} />}
            </div>
          );
        })}
      </div>

      {noThresholdsConfigured && nothingAchievedYet && (
        <p style={{ margin: "18px 0 0", fontSize: 11.5, color: T.inkFaint, fontStyle: "italic" }}>
          No advancement threshold is set on these levels yet, so a level only counts as "Achieved" once it's 100% complete — an admin can set a lower bar per level in Performance Bands.
        </p>
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
