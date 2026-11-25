import { BRAND, FONT, pill } from "../../../theme/brand";
import { formatKsh } from "../services/affiliatesApi";

// Monthly targets (25 Nov 2026 — server: affiliate.targets.js): one measure's bar, its state pill,
// and the words for both. Shared by the admin's Targets tab / Affiliates list and Refer & earn.
// Colours from the system palette: met navy, on track mid blue, behind gold, missed grey — never
// red (that's for destructive actions and errors).

export const TARGET_STATE = {
  met: { word: "Target met", tone: "strong", fill: BRAND.navy },
  on_track: { word: "On track", tone: "good", fill: BRAND.mid },
  behind: { word: "Behind", tone: "waiting", fill: BRAND.gold },
  missed: { word: "Missed", tone: "neutral", fill: BRAND.faint },
  none: { word: "No target", tone: "neutral", fill: BRAND.faint },
};

export function TargetPill({ state }) {
  const s = TARGET_STATE[state] || TARGET_STATE.none;
  return <span style={pill(s.tone)}>{s.word}</span>;
}

const amount = (kind, n) => (kind === "money" ? formatKsh(n) : `${n} ${n === 1 ? "family" : "families"}`);

// "KSh 18,000 of 30,000" / "4 of 6 families", or what was reached when there's no target.
export function targetWords(kind, p) {
  if (!p) return "—";
  if (p.target == null) return kind === "money" ? formatKsh(p.value) : amount("families", p.value);
  return kind === "money" ? `${formatKsh(p.value)} of ${formatKsh(p.target).replace("KSh ", "")}` : `${p.value} of ${amount("families", p.target)}`;
}

// A bar towards the target, with a tick where an even pace through the month would be today.
export function TargetBar({ kind, progress, label, compact = false, showPace = true }) {
  const p = progress;
  const s = TARGET_STATE[p?.state] || TARGET_STATE.none;
  const share = p?.target ? Math.min(1, p.value / p.target) : 0;
  const pace = p?.target && p.expected != null && showPace && p.state !== "met" ? Math.min(1, p.expected / p.target) : null;
  return (
    <div style={{ display: "grid", gap: compact ? 3 : 5, minWidth: 0, fontFamily: FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        {label && <span style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 800, color: BRAND.muted }}>{label}</span>}
        <span style={{ fontSize: compact ? 12 : 13.5, fontWeight: 800, color: BRAND.ink }}>
          {targetWords(kind, p)}{p?.percent != null && <span style={{ color: BRAND.muted, fontWeight: 700 }}> · {p.percent}%</span>}
        </span>
      </div>
      {p?.target != null && (
        <div role="progressbar" aria-label={label || (kind === "money" ? "Money" : "Families")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, p.percent || 0)}
          style={{ position: "relative", height: compact ? 6 : 9, borderRadius: 999, background: BRAND.track }}>
          <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${share * 100}%`, borderRadius: 999, background: s.fill, transition: "width .3s" }} />
          {pace != null && pace > 0 && (
            <div title="Where an even pace through the month would be today" style={{ position: "absolute", top: -3, bottom: -3, left: `calc(${pace * 100}% - 1px)`, width: 2, borderRadius: 2, background: BRAND.ink, opacity: 0.45 }} />
          )}
        </div>
      )}
    </div>
  );
}

// What's still needed, in a sentence: "KSh 12,000 and 2 families to go".
export function toGo(standing) {
  if (!standing) return null;
  const parts = [];
  if (standing.money?.target != null && standing.money.remaining > 0) parts.push(formatKsh(standing.money.remaining));
  if (standing.families?.target != null && standing.families.remaining > 0) parts.push(amount("families", standing.families.remaining));
  return parts.length ? `${parts.join(" and ")} to go` : null;
}
