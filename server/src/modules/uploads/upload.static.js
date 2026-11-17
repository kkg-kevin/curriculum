const path = require("path");

// Uploaded files a browser would run as a page if opened directly: HTML, and SVG/XML, which can
// carry script. A learner's code upload is often exactly this, and opened from the API's own
// address it would run with the viewer's session. These are sent as downloads instead, and
// sandboxed for a browser that displays them anyway. An SVG shown through an <img> tag is not
// affected — images never run script and ignore the download header.
const ACTIVE_EXTENSIONS = new Set([".html", ".htm", ".xhtml", ".xht", ".svg", ".svgz", ".xml", ".xsl", ".xslt"]);

function isActiveContent(filePath) {
  return ACTIVE_EXTENSIONS.has(path.extname(String(filePath || "")).toLowerCase());
}

// Every upload is saved under a new random name (upload.middleware.js) and never overwritten, so
// a browser may keep it for 30 days without asking again (17 Nov 2026) — photos and covers stop
// downloading on every visit.
const CACHE_CONTROL = "public, max-age=2592000, immutable";

// express.static's setHeaders hook for /uploads.
function setUploadHeaders(res, filePath) {
  res.setHeader("Cache-Control", CACHE_CONTROL);
  if (!isActiveContent(filePath)) return;
  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Content-Security-Policy", "sandbox");
}

module.exports = { setUploadHeaders, isActiveContent, CACHE_CONTROL };
