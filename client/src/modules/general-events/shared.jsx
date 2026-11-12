import { BRAND, FONT, pill } from "../../theme/brand";

// Shared look for the General events screens (colours from theme/brand.js).
export const STATE = {
  draft: { label: "Draft", tone: "neutral" },
  upcoming: { label: "Upcoming", tone: "good" },
  on_now: { label: "On now", tone: "waiting" },
  ended: { label: "Ended", tone: "strong" },
  cancelled: { label: "Cancelled", tone: "danger" },
};
export const REG_STATUS = {
  registered: { label: "Registered", tone: "good" },
  waitlisted: { label: "Waiting list", tone: "waiting" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
export const SOURCE_LABEL = {
  website: "Website",
  website_popup: "Website pop-up",
  system: "In the system",
  system_popup: "System pop-up",
  walk_in: "Walk-in",
  staff: "Added by staff",
};

export function StatePill({ state, style }) {
  const s = STATE[state] || STATE.draft;
  return <span style={{ ...pill(s.tone), ...style }}>{s.label}</span>;
}

export const btn = (variant = "plain", extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 38, padding: "0 14px", borderRadius: 10,
  fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", boxSizing: "border-box",
  ...(variant === "primary" ? { background: BRAND.navy, color: "#fff", border: `1.5px solid ${BRAND.navy}` }
    : variant === "gold" ? { background: BRAND.gold, color: "#3d2a00", border: `1.5px solid ${BRAND.gold}` }
    : variant === "danger" ? { background: "#fff", color: BRAND.danger, border: `1.5px solid ${BRAND.dangerBorder}` }
    : variant === "ghost" ? { background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.35)" }
    : { background: "#fff", color: BRAND.inkSoft, border: `1.5px solid ${BRAND.border}` }),
  ...extra,
});

export const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, fontSize: 14, fontFamily: FONT, color: BRAND.ink, background: "#fff" };
export const labelStyle = { display: "grid", gap: 6, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, minWidth: 0 };
export const hintStyle = { fontSize: 12, fontWeight: 500, color: BRAND.muted, lineHeight: 1.5 };

export const plural = (n, one, many = `${one}s`) => `${n} ${Number(n) === 1 ? one : many}`;
export const shortDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const shortDateTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

// Mobile-first rules for the General events screens (class-based so global.css's phone rules,
// which rewrite inline grid styles, leave them alone).
export const EVENTS_CSS = `
  .ge-page { font-family: ${FONT}; display: grid; gap: 16px; min-width: 0; }
  .ge-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .ge-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .ge-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .ge-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  .ge-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .ge-tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1.5px solid ${BRAND.border}; }
  .ge-tab { background: none; border: none; border-bottom: 3px solid transparent; margin-bottom: -1.5px; padding: 10px 14px; font: 700 13.5px ${FONT}; color: ${BRAND.muted}; cursor: pointer; display: inline-flex; gap: 7px; align-items: center; }
  .ge-tab[aria-selected="true"] { color: ${BRAND.navy}; border-bottom-color: ${BRAND.gold}; }
  .ge-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; border: 1.5px solid ${BRAND.border}; background: #fff; font: 700 12.5px ${FONT}; color: ${BRAND.inkSoft}; cursor: pointer; }
  .ge-chip[aria-pressed="true"] { background: ${BRAND.navy}; border-color: ${BRAND.navy}; color: #fff; }
  .ge-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ge-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: ${BRAND.muted}; padding: 8px 10px; border-bottom: 1.5px solid ${BRAND.border}; white-space: nowrap; }
  .ge-table td { padding: 10px; border-bottom: 1px solid ${BRAND.line}; vertical-align: top; color: ${BRAND.inkSoft}; }
  @media (max-width: 900px) {
    .ge-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 640px) {
    .ge-grid-2, .ge-grid-3 { grid-template-columns: 100%; }
    .ge-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .ge-page input, .ge-page select, .ge-page textarea { font-size: 16px !important; }
    .ge-hide-phone { display: none !important; }
    .ge-tab { padding: 10px 10px; }
  }
`;
