import { useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiChevronDown, FiChevronUp, FiClock, FiTarget } from "react-icons/fi";
import { BRAND as C, FONT, card, pill } from "../../theme/brand";
import { OVERALL, STATUS, formatValue, iconOf, targetText } from "./standards";

// A mentor's standing against the workspace's mentor standards — the Standards tab of their profile
// (admins, staff, their supervisor, and the mentor themself; never a hub). Read as a short list, in
// three groups: what needs attention (with what helps), what meets the standard, and — folded away —
// what has too little data yet. Each row: the standard, their figure against it on a bar, the
// standard itself and how much evidence it rests on. Then the last months' standing. `own` words it
// for the mentor.

const fill = { meets: C.mid, close: C.gold, below: C.danger, grace: C.sky, not_enough: C.border };
const monthShort = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-KE", { month: "short" });

// How far along the bar a value sits: % on 0–100, stars on 0–5. Counts (lower is better) have no bar.
function share(item) {
  if (item.value == null || item.higherIsBetter === false) return null;
  const top = item.unit === "★" ? 5 : 100;
  return { value: Math.max(0, Math.min(100, (Number(item.value) / top) * 100)), target: Math.max(0, Math.min(100, (Number(item.target) / top) * 100)) };
}

function Row({ item, showTip }) {
  const look = STATUS[item.status] || STATUS.not_enough;
  const bar = share(item);
  const waiting = item.status === "not_enough";
  const Icon = iconOf(item.key);
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${C.line}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 18px" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.ink, display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 9, background: C.canvas, border: `1.5px solid ${fill[item.status] || C.border}`, color: waiting ? C.faint : C.navy, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={15} /></span>
          {item.label}
        </p>
        <p style={{ margin: "2px 0 0 40px", fontSize: 12, color: C.faint, lineHeight: 1.45 }}>
          {waiting ? `${item.evidence} of ${item.minEvidence} ${item.evidenceLabel} needed` : item.unit === "" ? "Right now" : `From ${item.evidence} ${item.evidenceLabel}`}
        </p>
      </div>
      <div style={{ flex: "0 0 auto", minWidth: 74, textAlign: "right" }}>
        <span style={{ fontSize: 19, fontWeight: 900, color: waiting ? C.faint : C.ink }}>{formatValue(item.value, item.unit)}</span>
      </div>
      <div style={{ flex: "1 1 180px", minWidth: 150 }}>
        {bar ? (
          <div aria-hidden style={{ position: "relative", height: 8, borderRadius: 999, background: C.track }}>
            <div style={{ width: `${bar.value}%`, height: "100%", borderRadius: 999, background: fill[item.status] || C.mid }} />
            <div title="The standard" style={{ position: "absolute", top: -4, left: `calc(${bar.target}% - 1px)`, width: 2, height: 16, borderRadius: 1, background: C.navy }} />
          </div>
        ) : <div aria-hidden style={{ height: 8 }} />}
        <p style={{ margin: "5px 0 0", fontSize: 11.5, color: C.muted }}>Standard: {targetText(item)}</p>
      </div>
      <span style={{ ...pill(look.tone), flex: "0 0 auto" }}>{look.label}</span>
      {showTip && item.tip && (
        <p style={{ flex: "1 1 100%", margin: "2px 0 0 40px", padding: "8px 12px", borderRadius: 10, background: C.canvas, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
          <strong style={{ color: C.ink }}>What helps:</strong> {item.tip}
        </p>
      )}
    </div>
  );
}

function Group({ title, icon: Icon, tone, items, showTips, children }) {
  if (!items.length && !children) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ margin: "0 0 2px", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: tone, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} /> {title}{items.length ? ` · ${items.length}` : ""}
      </p>
      {items.map((i) => <Row key={i.key} item={i} showTip={showTips} />)}
      {children}
    </div>
  );
}

export default function StandardsCard({ standing, own = false, showTips = true }) {
  const [showWaiting, setShowWaiting] = useState(false);
  if (!standing || !standing.items?.length) return null;
  const overall = OVERALL[standing.overall] || OVERALL.not_enough;
  const attention = standing.items.filter((i) => ["below", "close", "grace"].includes(i.status)).sort((a, b) => (a.status === "below" ? -1 : 0) - (b.status === "below" ? -1 : 0));
  const meeting = standing.items.filter((i) => i.status === "meets");
  const waiting = standing.items.filter((i) => i.status === "not_enough");
  const history = (standing.history || []).filter((h) => h.counted > 0);

  return (
    <section style={{ ...card, padding: "18px 20px", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}>
            <FiTarget color={C.mid} /> {own ? "Your standards" : "Mentor standards"}
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
            {own ? "The bar every mentor here is measured against, and where you stand." : "The workspace's bar for every mentor, and where they stand."}
            {standing.inGrace ? ` ${own ? "You're" : "They're"} new: for the first ${standing.graceDays} days nothing counts as below.` : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.ink, lineHeight: 1 }}>
              {standing.met}<span style={{ fontSize: 15, color: C.faint, fontWeight: 800 }}> / {standing.counted}</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>standards met</div>
          </div>
          <span style={pill(overall.tone)}>{overall.label}</span>
        </div>
      </div>

      <Group title="Needs attention" icon={FiAlertTriangle} tone={C.danger} items={attention} showTips={showTips} />
      <Group title="Meeting the standard" icon={FiCheckCircle} tone={C.mid} items={meeting} showTips={false} />
      {waiting.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setShowWaiting((v) => !v)}
            aria-expanded={showWaiting}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: FONT, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted }}
          >
            <FiClock size={13} /> Waiting for data · {waiting.length} {showWaiting ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
          </button>
          {showWaiting && waiting.map((i) => <Row key={i.key} item={i} showTip={false} />)}
        </div>
      )}

      {history.length > 1 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
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
