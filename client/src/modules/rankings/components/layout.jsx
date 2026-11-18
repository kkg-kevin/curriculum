import { KID_FONT } from "../../learner-portal/components/profile/theme";

// The full-width grid the ranking and analytics pages are laid out on (19 Nov 2026: "end to end
// on the screen"). Twelve columns on a wide screen; paired cards (span 4–8) stack under 1100px,
// halves under 760px. Classes rather than inline grids — global.css rewrites inline
// `minmax(` grids on phones.
export const LAYOUT_CSS = `
.rk-page { font-family: ${KID_FONT}; display: grid; grid-template-columns: 100%; gap: 18px; width: 100%; min-width: 0; }
.rk-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 18px; align-items: stretch; width: 100%; }
.rk-grid > * { min-width: 0; }
.rk-s12 { grid-column: span 12; } .rk-s8 { grid-column: span 8; } .rk-s7 { grid-column: span 7; }
.rk-s6 { grid-column: span 6; } .rk-s5 { grid-column: span 5; } .rk-s4 { grid-column: span 4; } .rk-s3 { grid-column: span 3; }
.rk-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; }
.rk-glass-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.rk-badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 12px; }
.rk-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.rk-cards-s { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.rk-cards-m { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.rk-cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px 32px; }
.rk-hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1.4fr) auto; gap: 24px; align-items: center; }
.rk-scroll { overflow-x: auto; scrollbar-width: none; } .rk-scroll::-webkit-scrollbar { display: none; }
.rk-tab:hover:not([aria-selected="true"]) { background: #EDF2F8 !important; }
.rk-tab:focus-visible, .rk-pill:focus-visible { outline: 2px solid #2e7db5; outline-offset: 2px; }
@media (max-width: 1280px) {
  .rk-hero { grid-template-columns: minmax(0, 1fr) auto; }
  .rk-hero > .rk-hero-tiles { grid-column: 1 / -1; grid-row: 2; }
  .rk-s3 { grid-column: span 6; }
}
@media (max-width: 1000px) {
  .rk-s8, .rk-s7, .rk-s5, .rk-s4 { grid-column: span 12; }
}
@media (max-width: 760px) {
  .rk-s6, .rk-s3 { grid-column: span 12; }
  .rk-hero { grid-template-columns: 100%; }
  .rk-hero > * { justify-self: stretch; }
  .rk-hero > .rk-hero-tiles { grid-row: 3; }
  .rk-cards-s, .rk-cards-m, .rk-cols { grid-template-columns: 100%; }
  .rk-glass-tiles { gap: 8px; }
  .rk-glass-tiles > div { padding: 10px 10px !important; }
  .rk-glass-tiles .rk-gt-icon { display: none !important; }
  .rk-glass-tiles .rk-gt-value { font-size: 19px !important; }
  .rk-glass-tiles .rk-gt-label { font-size: 11.5px !important; }
  .rk-kpis, .rk-badges { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rk-grid, .rk-page { gap: 14px; }
  .rk-fade { -webkit-mask-image: linear-gradient(90deg, #000 82%, transparent); mask-image: linear-gradient(90deg, #000 82%, transparent); }
}
`;

export function LayoutStyles() {
  return <style>{LAYOUT_CSS}</style>;
}
