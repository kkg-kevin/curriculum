import { FiAward, FiStar, FiZap } from "react-icons/fi";

const T = {
  accent: "#25476a",
  accentLight: "#38aae1",
  tintBg: "#e8f5fb",
  ink: "#111827",
  inkMuted: "#6B7280",
  inkFaint: "#9CA3AF",
  border: "#E5E7EB",
};

function SnapshotRow({ icon, label, value, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <p style={{ margin: "1px 0 0", fontSize: 13.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {value}{sub && <span style={{ fontWeight: 400, color: T.inkMuted }}> {sub}</span>}
        </p>
      </div>
    </div>
  );
}

// The same facts ProfileIdentityCard shows on the full profile (Developmental Academy /
// Current Level Summary / Learning Streak) — presented as a compact vertical rail card here
// instead of side-by-side pills, to fit the dashboard's right-rail layout. Profile stays the
// source of truth and keeps its own version; this is just a second, differently-shaped view
// of the same data. band/nextBand come from the same Engine 4 per-band completion +
// deriveBandJourney logic as ProfileIdentityCard and the Progress Arc card (see
// DashboardPage.jsx), so this row can never disagree with what those show.
function levelSummarySub(band, nextBand) {
  if (nextBand) return `${nextBand.completion}% of the way to ${nextBand.name}`;
  if (band) return "Highest level reached";
  return "Complete graded work to begin";
}

export default function DevelopmentalSnapshotCard({ stage, band, nextBand }) {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${T.border}`, padding: 18 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, color: T.accentLight, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        Developmental Snapshot
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SnapshotRow
          icon={<FiAward size={16} />}
          label="Developmental Academy"
          value={stage?.name || "Not yet placed"}
          sub={stage?.ageRange ? `(${stage.ageRange})` : null}
        />
        <SnapshotRow
          icon={<FiStar size={16} />}
          label="Current Level Summary"
          value={band?.name || "Not yet placed"}
          sub={levelSummarySub(band, nextBand)}
        />
        <SnapshotRow icon={<FiZap size={16} />} label="Learning Streak" value="Not tracked yet" />
      </div>
    </div>
  );
}
