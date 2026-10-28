// A page's main tabs (Tabs) and a filter inside a tab (Segmented) — one look across the app
// (Hub Check-ins, Activity, Billing). Both scroll sideways on a phone.

const ACCENT = "#25476a";
const font = "Inter, sans-serif";

// Hover and keyboard focus (inline styles can't have them). Rendered by each bar; repeats are harmless.
const STYLES = `
  .ui-tab:hover:not([aria-selected="true"]):not([aria-pressed="true"]) { background-color: rgba(37,71,106,0.06) !important; }
  .ui-tab:focus-visible { outline: 2px solid #2e7db5; outline-offset: 2px; }
  .ui-tab-scroll { scrollbar-width: none; } .ui-tab-scroll::-webkit-scrollbar { display: none; }
`;

// A count beside a tab's name. `alert` (e.g. things that went wrong) shows amber whenever it's
// above nought.
function CountBadge({ on, alert, children }) {
  const look = alert
    ? { background: "#FEF3C7", color: "#B45309" }
    : on ? { background: "rgba(255,255,255,0.22)", color: "#fff" } : { background: "#E2E8F0", color: "#475569" };
  return (
    <span style={{ minWidth: 18, height: 18, padding: "0 6px", boxSizing: "border-box", borderRadius: 999, fontSize: 11, fontWeight: 800, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", justifyContent: "center", ...look }}>
      {children}
    </span>
  );
}

const countText = (count) => (typeof count === "number" ? count.toLocaleString() : count);

// The page's main tabs: a white bar, the open tab filled. Each tab: { key, label, icon?, count?,
// alert? } — `icon` a react-icons or MUI icon component; a count of null/undefined shows no badge;
// `alert` turns a non-zero count amber.
export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="ui-tab-scroll" style={{ display: "flex", gap: 4, padding: 4, background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)", overflowX: "auto", maxWidth: "100%", width: "fit-content", boxSizing: "border-box" }}>
      <style>{STYLES}</style>
      {tabs.map(({ key, label: text, icon: Icon, count, alert }) => {
        const on = key === value;
        return (
          <button key={key || "all"} type="button" role="tab" aria-selected={on} className="ui-tab" onClick={() => onChange(key)} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px", border: 0, borderRadius: 9, background: on ? ACCENT : "transparent", color: on ? "#fff" : "#4B5563", fontSize: 13, fontWeight: 700, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            {Icon && <Icon size={14} style={{ fontSize: 16, flexShrink: 0 }} />}{text}
            {count != null && <CountBadge on={on} alert={alert && count > 0}>{countText(count)}</CountBadge>}
          </button>
        );
      })}
    </div>
  );
}

// A filter inside a tab (Report due / Upcoming / …): a grey track, the chosen one raised white —
// lighter than the tabs above it. Each option: { key, label, count? }; a count of 0 shows none.
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="ui-tab-scroll" style={{ display: "inline-flex", gap: 2, padding: 3, background: "#EEF2F6", borderRadius: 10, overflowX: "auto", maxWidth: "100%", boxSizing: "border-box" }}>
      <style>{STYLES}</style>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button key={o.key ?? "all"} type="button" aria-pressed={on} className="ui-tab" onClick={() => onChange(o.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", border: 0, borderRadius: 8, background: on ? "#fff" : "transparent", color: on ? "#111827" : "#6B7280", boxShadow: on ? "0 1px 3px rgba(15,23,42,0.12)" : "none", fontSize: 12.5, fontWeight: 700, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            {o.label}{o.count ? <CountBadge>{countText(o.count)}</CountBadge> : null}
          </button>
        );
      })}
    </div>
  );
}
