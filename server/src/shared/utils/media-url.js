const { API_PUBLIC_URL } = require("../../config/env");

// Uploaded media is stored as a root-relative path ("/uploads/<file>") — see
// upload.controller.js. The admin client resolves that fine against its axios baseURL, but the
// public digifunzi-landing site consumes /api/public/* responses cross-origin, where an
// <img src="/uploads/x"> would resolve against the landing site's own origin. So the public
// serializers run coverImage (and any other stored media path) through this.
//
// - Already-absolute values (http[s]://, protocol-relative //, or data:) are returned as-is —
//   an admin may paste a full CDN/stock URL when authoring.
// - A relative path is prefixed with API_PUBLIC_URL when that's set; if it isn't (local dev
//   with no override), the raw value is returned unchanged and the landing site's own
//   resolveMediaUrl fallback handles it.
function toAbsoluteMediaUrl(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (/^(https?:)?\/\//i.test(v) || v.startsWith("data:")) return v;
  if (!API_PUBLIC_URL) return v;
  return `${API_PUBLIC_URL.replace(/\/+$/, "")}/${v.replace(/^\/+/, "")}`;
}

module.exports = { toAbsoluteMediaUrl };
