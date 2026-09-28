import { defineConfig } from "vite";

const CAPABLE_PAGE_TITLE = "Capable Kneya | Ready For Life and Impact";

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: "environment-page-title",
      transformIndexHtml(html) {
        const title = mode === "capable" ? CAPABLE_PAGE_TITLE : "Curriculum App";
        return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
      },
    },
  ],
}));
