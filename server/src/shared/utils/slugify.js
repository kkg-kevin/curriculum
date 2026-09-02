// Mirrors digifunzi-landing's src/utils/slugify.js closely enough that a name typed here
// produces the same slug the frontend's own mock fixtures used to hand-derive — lowercase,
// non-alphanumerics collapsed to single hyphens, no leading/trailing hyphen.
function slugify(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = { slugify };
