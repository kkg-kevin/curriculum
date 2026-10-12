import { defineConfig } from "vite";

const CAPABLE_PAGE_TITLE = "Capable Kneya | Ready For Life and Impact";

// The browser-tab title per build mode (see package.json's build / build:live / build:capable).
// Live is the plain product name; the Dev site and a local dev server say so first, so a tab
// can't be mistaken for Live. The tab icon follows the same split — see src/branding.js.
const PAGE_TITLES = {
  capable: CAPABLE_PAGE_TITLE,
  live: "Digifunzi",
  production: "DEV · Digifunzi",
  development: "LOCAL · Digifunzi",
};

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: "environment-page-title",
      transformIndexHtml(html) {
        const title = PAGE_TITLES[mode] || PAGE_TITLES.live;
        return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
      },
    },
  ],
  build: {
    // Vite's default CSS target rewrites `@media (max-width: 640px)` into the newer range form
    // `(width <= 640px)`, which iPhones on iOS older than 16.4 ignore — they would lose every
    // phone rule in src/styles/global.css. Targeting older Safari keeps the classic form.
    cssTarget: ["safari14", "chrome90"],
  },
}));
