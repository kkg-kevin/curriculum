const env = require("../../config/env");

// The public marketing site (digifunzi-landing) reads ONE designated admin's content — the
// admin whose `users.id` is in PUBLIC_CONTENT_ADMIN_ID. Every admin is an isolated tenant, so
// an anonymous visitor (no login) needs the backend told explicitly whose content to show.
// Unset → 503, the "not configured" posture every public endpoint uses. Shared by
// public-site.service.js (pathways) and public-project.service.js (for-sale projects).
function requirePublicContentAdminId() {
  if (!env.PUBLIC_CONTENT_ADMIN_ID) {
    const err = new Error("Public content is not configured");
    err.statusCode = 503;
    throw err;
  }
  return env.PUBLIC_CONTENT_ADMIN_ID;
}

// Rich-text fields (course/pathway/project descriptions, project overview) are authored as
// TipTap HTML. The landing site renders these as plain text, so flatten tags and decode the
// handful of entities the editor emits before exposing them publicly.
function htmlToText(html) {
  if (!html) return "";
  return String(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

module.exports = { requirePublicContentAdminId, htmlToText };
