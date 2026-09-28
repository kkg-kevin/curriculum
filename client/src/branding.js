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
export const BRAND_FAVICON = isCapable ? capableFavicon : null;
