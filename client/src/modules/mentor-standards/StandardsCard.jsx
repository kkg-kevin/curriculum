import { FiAlertTriangle, FiCheckCircle, FiTarget } from "react-icons/fi";
import { BRAND as C, FONT, card, pill } from "../../theme/brand";
import { OVERALL, STATUS, formatValue, targetText } from "./standards";

// A mentor's standing against the workspace's mentor standards — the first card of their performance
// profile (admins, staff, their supervisor, and the mentor themself; never a hub). Headline: how many
// standards they meet of those with enough evidence, and overall; then each standard: their figure,
// the target, a bar, where they stand, how much evidence it rests on and — when not met — what helps;
// then the last months' standing. `own` words it for the mentor.

const fill = { meets: C.mid, close: C.gold, below: C.danger, grace: C.sky, not_enough: C.border };
const monthShort = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-KE", { month: "short" });

// How far along the bar a value sits: % on 0–100, stars on 0–5. Counts (lower is better) have no bar.
function share(item) {
  if (item.value == null || item.higherIsBetter === false) return null;
  const top = item.unit === "★" ? 5 : 100;
  return { value: Math.max(0, Math.min(100, (Number(item.value) / top) * 100)), target: Math.max(0, Math.min(100, (Number(item.target) / top) * 100)) };
}

function StandardRow({ item, showTips }) {
  const look = STATUS[item.status] || STATUS.not_enough;
  const bar = share(item);
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${item.status === "below" ? C.dangerBorder : C.line}`, background: item.status === "below" ? C.dangerTint : C.surface, display: "grid", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span title={item.describe} style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{item.label}</span>
        <span style={pill(look.tone)}>{look.label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: C.ink, lineHeight: 1 }}>{formatValue(item.value, item.unit)}</span>
        <span style={{ fontSize: 12, color: C.muted }}>Standard: {targetText(item)}</span>
      </div>
      {bar && (
        <div aria-hidden style={{ position: "relative", height: 7, borderRadius: 999, background: C.track }}>
          <div style={{ width: `${bar.value}%`, height: "100%", borderRadius: 999, background: fill[item.status] || C.mid }} />
          <div title="Target" style={{ position: "absolute", top: -3, left: `calc(${bar.target}% - 1px)`, width: 2, height: 13, borderRadius: 1, background: C.navy }} />
        </div>
      )}
      <div style={{ fontSize: 11.5, color: C.faint }}>
        {item.status === "not_enough"
          ? `${item.evidence} ${item.evidenceLabel} so far — counts from ${item.minEvidence}`
          : item.unit === "" ? item.describe : `From ${item.evidence} ${item.evidenceLabel}`}
      </div>
      {showTips && item.tip && <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}><strong>What helps:</strong> {item.tip}</div>}
    </div>
  );
}

export default function StandardsCard({ standing, own = false, showTips = true }) {
  if (!standing || !standing.items?.length) return null;
  const overall = OVERALL[standing.overall] || OVERALL.not_enough;
  const order = { below: 0, close: 1, grace: 2, meets: 3, not_enough: 4 };
  const items = [...standing.items].sort((a, b) => order[a.status] - order[b.status]);
  const history = (standing.history || []).filter((h) => h.counted > 0);
  const Icon = standing.overall === "below" ? FiAlertTriangle : standing.overall === "meets" ? FiCheckCircle : FiTarget;

  return (
    <section style={{ ...card, padding: "18px 20px", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon color={standing.overall === "below" ? C.danger : C.mid} /> {own ? "Your standards" : "Mentor standards"}
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
            {own ? "The bar every mentor here is measured against, and where you stand." : "The workspace's bar for every mentor, and where they stand."}
            {standing.inGrace ? ` ${own ? "You're" : "They're"} new — for the first ${standing.graceDays} days nothing counts as below.` : ""}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.ink, lineHeight: 1 }}>
            {standing.met}<span style={{ fontSize: 15, color: C.faint, fontWeight: 800 }}> / {standing.counted}</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>standards met</div>
          <span style={{ ...pill(overall.tone), marginTop: 6 }}>{overall.label}</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))" }}>
        {items.map((i) => <StandardRow key={i.key} item={i} showTips={showTips} />)}
      </div>

      {history.length > 1 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: C.sky, textTransform: "uppercase", letterSpacing: "0.07em" }}>Month by month</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {history.map((h) => (
              <div key={h.month} title={`${h.met} of ${h.counted} met`} style={{ textAlign: "center", minWidth: 44 }}>
                <div style={{ ...pill((OVERALL[h.overall] || OVERALL.not_enough).tone), justifyContent: "center", minWidth: 40 }}>{h.met}/{h.counted}</div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{monthShort(h.month)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
