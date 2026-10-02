import digifunziLogo from "./assets/Logo-image.png";
import capableLogo from "./assets/Capable_Logo_Primary.png";
import capableLogoOnDark from "./assets/Capable_Logo_Secondary_White.png";
import capableFavicon from "./assets/Capable_Favicon.png";

// Vite mode is baked in at build time (see package.json's build/build:live/build:capable
// scripts), so this resolves once per deploy bundle, not at runtime.
const isCapable = import.meta.env.MODE === "capable";

// Digifunzi's mark is a plain silhouette, safe to force white with `brightness(0) invert(1)`
// on dark backgrounds (sidebar, PDF headers). Capable's is a flat navy/gold wordmark on an
// opaque light background — inverting it would render a solid white block, so call sites
// must use `darkBgFilter` instead of hardcoding the invert filter.
export const BRAND_NAME = isCapable ? "Capable" : "Digifunzi";
export const BRAND_LOGO = isCapable ? capableLogo : digifunziLogo;
export const BRAND_LOGO_DARK_BG = isCapable ? capableLogoOnDark : digifunziLogo;
export const BRAND_LOGO_DARK_BG_FILTER = isCapable ? "none" : "brightness(0) invert(1)";

// The browser-tab icon. Every environment sets one explicitly: a site with no icon of its own
// keeps showing whatever the browser last cached for it, which is how Live came to show
// Capable's. The Digifunzi environments share one mark — a "d" on a rounded square — in a
// different colour each, so a Dev tab and a Live tab can be told apart at a glance:
//   live → navy (the real thing) · production, i.e. the Dev site → amber · local dev → grey
const TAB_COLORS = {
  live: { background: "#25476a", letter: "#ffffff" },
  production: { background: "#feb139", letter: "#25476a" },
  development: { background: "#6B7280", letter: "#ffffff" },
};
function letterIcon({ background, letter }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${background}"/><text x="32" y="47" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700" text-anchor="middle" fill="${letter}">d</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
export const BRAND_FAVICON = isCapable ? capableFavicon : letterIcon(TAB_COLORS[import.meta.env.MODE] || TAB_COLORS.live);
export const BRAND_FAVICON_TYPE = isCapable ? "image/png" : "image/svg+xml";
export const IS_CAPABLE = isCapable;
// Logo height on the sign-in / register screens — Capable's wordmark reads small at 34px.
export const BRAND_AUTH_LOGO_HEIGHT = isCapable ? 52 : 34;
