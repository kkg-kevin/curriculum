import DOMPurify from "dompurify";

// Cleans rich-text HTML before it is put on the page (RichContent in courses and assessments).
// Everything the editor produces is kept — headings, lists, tables, links, images, the video
// node — while scripts, event-handler attributes (onerror=…) and javascript: links are removed.
// Content is written by staff, but it also travels between workspaces through Sharing, so what
// one workspace wrote is displayed in another.
const OPTIONS = {
  // Not in DOMPurify's default list: links opening in a new tab, the table column widths the
  // editor stores, and the video player's attributes.
  ADD_ATTR: ["target", "colwidth", "controlslist", "playsinline"],
};

export function sanitizeHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html, OPTIONS);
}
