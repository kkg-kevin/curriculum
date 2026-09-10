const CompetitionModel = require("../competitions/competition.model");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requirePublicContentAdminId, htmlToText } = require("../../shared/utils/public-content");

// The public marketing site's Competitions section (digifunzi-landing's /competitions). A
// competition is a row in the `competitions` table (an independent module — a sibling of
// Curriculum/Programs) that an admin marked `isPublic: true` and that isn't `draft`. Only the
// designated PUBLIC_CONTENT_ADMIN_ID's competitions are ever served — same tenant-scoping
// posture as pathways / projects / store / bootcamps / hubs (503 if that env var is unset).
//
// The projection is hand-built. Internal fields (ownerAdminId, programId, isPublic) are never
// exposed — a visitor sees the event copy, the dates and the Track cards.

// `competitions` has no slug column — computed at read time from `name`, same as the rest.
function computedSlug(c) {
  return slugify(c.name) || "competition";
}

function pickForSlug(matches) {
  if (matches.length <= 1) return matches[0] || null;
  return matches.find((c) => c.coverImage) || matches.find((c) => c.status === "open") || matches[0];
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

// A Track card — description flattened to plain text (it may be authored as rich text), URLs
// passed through as-is (they're external links or /enroll paths).
function projectTrack(t, i) {
  return {
    id: t.id || `track-${i + 1}`,
    name: t.name,
    subtitle: t.subtitle || "",
    description: htmlToText(t.description),
    highlights: arr(t.highlights),
    registerUrl: t.registerUrl || "",
    knowMoreUrl: t.knowMoreUrl || "",
  };
}

function listItem(c) {
  const tracks = arr(c.tracks);
  return {
    id: c.id,
    slug: computedSlug(c),
    name: c.name,
    edition: c.edition || "",
    level: c.level || "",
    format: c.format || null,
    cadence: c.cadence || null,
    startDate: c.startDate || "",
    endDate: c.endDate || "",
    coverImage: toAbsoluteMediaUrl(c.coverImage),
    status: c.status, // "open" | "closed" — never "draft" (findPublic excludes it)
    trackCount: tracks.length,
  };
}

async function publicCompetitions() {
  const ownerAdminId = requirePublicContentAdminId();
  return CompetitionModel.findPublic(ownerAdminId);
}

const PublicCompetitionService = {
  // GET /api/public/competitions — the designated admin's public competitions, newest first
  // then by name, slug collisions collapsed to one representative each.
  async listCompetitions() {
    const rows = await publicCompetitions();

    const bySlug = new Map();
    for (const c of rows) {
      const slug = computedSlug(c);
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push(c);
    }
    return [...bySlug.values()]
      .map(pickForSlug)
      .filter(Boolean)
      .map(listItem)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  // GET /api/public/competitions/:idOrSlug — list item + description + the Track cards.
  // Returns null (→ 404) for an unknown id/slug, a competition owned by a different admin, or
  // one that isn't public / is still draft.
  async getCompetition(idOrSlug) {
    const rows = await publicCompetitions();

    let c = rows.find((x) => x.id === idOrSlug) || null;
    if (!c) c = pickForSlug(rows.filter((x) => computedSlug(x) === idOrSlug));
    if (!c) return null;

    return {
      ...listItem(c),
      description: htmlToText(c.description),
      tracks: arr(c.tracks).map(projectTrack),
    };
  },
};

module.exports = PublicCompetitionService;
