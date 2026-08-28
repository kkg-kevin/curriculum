import { useMemo } from "react";
import { FiStar, FiLock, FiAward } from "react-icons/fi";
import { T, sectionHeaderStyle } from "./profile/theme";
import { useLearnerBandProgress } from "../../curriculum/hooks/useCompetencies";
import { deriveBandJourney } from "../utils/bandJourney";

// Gold ring + soft pulsing glow around whichever node the learner is actively working toward —
// the "you are here" marker a level-up UI needs to actually feel alive, not just a static list.
function ProgressRing({ percent, size, stroke, color }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#FDE9C0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

// achieved = filled gradient medal + star, glowing shadow instead of a plain checkmark.
// current  = gold percent ring with a pulsing halo, the "you are here" marker.
// locked   = flat gray disc with a padlock, dashed border — deliberately inert, no shadow at all,
// so the visual weight itself communicates "not reachable yet" before the reader parses the label.
function LevelNode({ band, status, ordinal, size = 64 }) {
  const achieved = status === "achieved";
  const current = status === "current";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 96 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        {current && (
          <>
            <div className="pa-pulse" style={{ position: "absolute", inset: -6, borderRadius: "50%", backgroundColor: "rgba(254,177,57,0.28)" }} />
            <ProgressRing percent={band.completion} size={size} stroke={6} color={T.gold} />
          </>
        )}
        <div
          style={{
            position: "absolute", inset: current ? 8 : 0, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: achieved ? "linear-gradient(135deg, #34d399, #059669)" : current ? "#FFFBEB" : "#F3F4F6",
            border: achieved ? "none" : current ? `1px solid ${T.gold}` : "1.5px dashed #D1D5DB",
            boxShadow: achieved ? "0 4px 12px rgba(5,150,105,0.35)" : "none",
            color: achieved ? "#fff" : current ? "#B45309" : "#B0B4BC",
            fontSize: 13, fontWeight: 800,
          }}
        >
          {achieved ? <FiStar size={20} /> : current ? `${Math.round(band.completion)}%` : <FiLock size={16} />}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: achieved ? "#059669" : current ? "#B45309" : "#B0B4BC", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Level {ordinal}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 12.5, fontWeight: 700, color: achieved || current ? T.ink : "#B0B4BC" }}>{band.name}</p>
        <p style={{ margin: "1px 0 0", fontSize: 10, fontWeight: 700, color: achieved ? "#059669" : current ? T.gold : "#B0B4BC" }}>
          {achieved ? "Unlocked" : current ? "In progress" : "Locked"}
        </p>
      </div>
    </div>
  );
}

// Solid gold-to-green once the band it leads FROM is achieved, partially filled (matching that
// band's own completion%) while the learner is actively working through it — thicker and more
// saturated than a plain data-table progress bar so the ladder itself reads as the reward track.
function LevelConnector({ status, percent }) {
  const fillPercent = status === "achieved" ? 100 : status === "current" ? percent : 0;
  const active = status === "achieved" || status === "current";
  return (
    <div style={{ flex: 1, minWidth: 28, height: 6, borderRadius: 3, backgroundColor: "#F3F4F6", overflow: "hidden", marginTop: 32 }}>
      <div
        style={{
          width: `${Math.min(100, Math.max(0, fillPercent))}%`, height: "100%", borderRadius: 3,
          background: active ? "linear-gradient(90deg, #059669, #feb139)" : "transparent",
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );
}

// A band with no admin-set bar only ever unlocks at 100% (see scoring-engines.js's
// runIndicatorProgressEngine) — so that's the honest number to quote here too, not 0/blank.
function effectiveThreshold(band) {
  return band.advancementThreshold > 0 ? band.advancementThreshold : 100;
}

function progressArcCaption(current, next) {
  // No level achieved yet — `next` is the very first level on the ladder itself, so "You're at
  // the start — X% of the way to unlocking Explorer" reads as if Explorer were both where the
  // learner already is AND where they're headed. Name it as the destination only, not a
  // from/to pair with no real "from."
  if (next && !current) return `You're just getting started — ${next.completion}% of the way to unlocking ${next.name}, your first level (needs ${effectiveThreshold(next)}%). Keep going!`;
  if (next) return `You're at ${current.name} — ${next.completion}% of the way to unlocking ${next.name} (needs ${effectiveThreshold(next)}%). Keep going!`;
  if (current) return `${current.name} — the highest level on this curriculum's ladder. Amazing work!`;
  return "Complete graded work tagged to these levels to start your journey.";
}

// Engine 4 — how much of each Performance Band's 100% this learner has actually completed
// (indicator-achievement-weighted). Rendered as a game-style level track: unlocked levels solid
// with a medal, the level currently being worked toward highlighted with a glowing "you are here"
// ring, everything after that shown locked behind a padlock — the same underlying data
// CompetenciesTabContent's Band Progress section always showed, restyled to read as a reward
// track instead of a plain data table, and pulled out to its own file so both the Profile
// Overview tab and the Dashboard's own upper section can show the exact same live progress.
// Named "Progress Arc" to match Engine 3 (scoring-engines.js → runProgressArcEngine), the
// score-to-band mapping this whole ladder visualizes — not just a "journey" through levels.
export default function ProgressArcCard({ curriculumId, learnerId }) {
  const { data: bandProgress = [] } = useLearnerBandProgress(curriculumId, learnerId);
  const { current, next } = useMemo(() => deriveBandJourney(bandProgress), [bandProgress]);
  if (bandProgress.length === 0) return null;

  const noThresholdsConfigured = bandProgress.every((bp) => !bp.advancementThreshold || bp.advancementThreshold <= 0);

  // `next` (the "current" node) can sit at any index — it's picked by highest completion, not
  // strictly the band right after the last achieved one (see bandJourney.js). But the ladder
  // itself is sequential from the learner's point of view: being actively worked toward a later
  // band means every earlier band is already behind them, even if that earlier band's own
  // independently-weighted formula never technically cleared its own bar. Without this, an
  // earlier band could render "Locked" while a later one shows "In progress" — reads as broken
  // (how are you past a level you haven't unlocked?). The "X of Y unlocked" badge below counts
  // the same way, so it never disagrees with what the ladder itself shows.
  const nextIndex = next ? bandProgress.findIndex((bp) => bp.bandId === next.bandId) : -1;
  const achievedCount = bandProgress.filter((bp, i) => bp.thresholdMet || (nextIndex !== -1 && i < nextIndex)).length;
  const nothingAchievedYet = achievedCount === 0;

  return (
    <div style={{
      backgroundColor: "#FFFDF9", borderRadius: 16, border: "1.5px solid #FDE9C0",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20, overflow: "hidden", position: "relative",
    }}>
      <style>{`
        @keyframes pa-pulse-glow {
          0%, 100% { transform: scale(0.94); opacity: 0.9; }
          50% { transform: scale(1.12); opacity: 0.35; }
        }
        .pa-pulse { animation: pa-pulse-glow 2.2s ease-in-out infinite; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: T.gold, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FiAward size={13} />
          </div>
          <h2 style={{ ...sectionHeaderStyle(), color: "#B45309" }}>Progress Arc</h2>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#B45309", backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>
          {achievedCount} of {bandProgress.length} unlocked
        </span>
      </div>

      <p style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 600, color: T.ink, lineHeight: 1.5 }}>{progressArcCaption(current, next)}</p>

      <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", paddingBottom: 4 }}>
        {bandProgress.map((bp, i) => {
          const status = bp.thresholdMet
            ? "achieved"
            : bp.bandId === next?.bandId
            ? "current"
            : nextIndex !== -1 && i < nextIndex
            ? "achieved"
            : "locked";
          return (
            <div key={bp.bandId} style={{ display: "flex", alignItems: "flex-start", flex: i === bandProgress.length - 1 ? "0 0 auto" : 1 }}>
              <LevelNode band={bp} status={status} ordinal={i + 1} />
              {i < bandProgress.length - 1 && <LevelConnector status={status} percent={bp.completion} />}
            </div>
          );
        })}
      </div>

      {noThresholdsConfigured && nothingAchievedYet && (
        <p style={{ margin: "18px 0 0", fontSize: 11.5, color: T.inkFaint, fontStyle: "italic" }}>
          No advancement threshold is set on these levels yet, so a level only counts as "Unlocked" once it's 100% complete — an admin can set a lower bar per level in Performance Bands.
        </p>
      )}
    </div>
  );
}
