const CompetitionModel = require("../competitions/competition.model");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requirePublicContentAdminId, htmlToText, resolveCoursePricing } = require("../../shared/utils/public-content");
const R = require("../competitions/competition-registration.rules");

// The public marketing site's Competitions section (digifunzi-landing's /competitions). A
// competition is a row in the `competitions` table (an independent module — a sibling of
// Curriculum/Events) that an admin marked `isPublic: true` and that isn't `draft`. Only the
// designated PUBLIC_CONTENT_ADMIN_ID's competitions are ever served — same tenant-scoping
// posture as pathways / projects / store / bootcamps / hubs (503 if that env var is unset).
//
// The projection is hand-built. Internal fields (ownerAdminId, eventId, isPublic) are never
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

// A track: its card (summary flattened to plain text) and, since 20 Nov 2026, its own page — the
// detail fields stay rich text (the website shows them through its safeHtml), plus how it's
// entered (individual / team, team size, fees) and its address (`slug`). `registerUrl` set =
// registration happens on an outside form; empty = our own sign-up.
function projectTrack(c, t, i, slug) {
  const entry = R.trackEntry(c, t);
  const ages = R.trackAges(c, t);
  return {
    id: t.id || `track-${i + 1}`,
    slug,
    name: t.name,
    subtitle: t.subtitle || "",
    description: htmlToText(t.description),
    highlights: arr(t.highlights),
    ageMin: ages.ageMin,
    ageMax: ages.ageMax,
    entry,
    coverImage: toAbsoluteMediaUrl(t.coverImage) || null,
    overview: t.overview || "",
    whatToDo: t.whatToDo || "",
    rules: t.rules || "",
    judging: arr(t.judging),
    prizes: arr(t.prizes),
    timeline: arr(t.timeline),
    resources: arr(t.resources),
    faqs: arr(t.faqs),
    registerUrl: t.registerUrl || "",
    knowMoreUrl: t.knowMoreUrl || "",
  };
}

// The "Competition information" section (20 Nov 2026).
function projectInfo(c) {
  const info = c.info && typeof c.info === "object" ? c.info : {};
  return {
    ageMin: info.ageMin ?? null,
    ageMax: info.ageMax ?? null,
    eligibilityNote: info.eligibilityNote || "",
    entryModes: R.entryModesOf(c),
    mode: info.mode || null,
    venue: info.venue || "",
    milestones: arr(info.milestones),
    prizes: arr(info.prizes),
    extras: arr(info.extras),
    // The entry fees, the same for every track (null = not set → free).
    fees: { individual: info.individualPrice ?? null, team: info.teamPrice ?? null, currency: info.currency || "KES" },
  };
}

// The first sentence or so of the description, plain text, for a banner or a card.
function summaryOf(html) {
  const text = htmlToText(html).replace(/\s+/g, " ").trim();
  if (text.length <= 200) return text;
  const cut = text.slice(0, 200);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > 80 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function infoOf(c) {
  if (c.info && typeof c.info === "object") return c.info;
  if (typeof c.info === "string") { try { return JSON.parse(c.info) || {}; } catch { return {}; } }
  return {};
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
    entryModes: R.entryModesOf(c),
    registrationOpenDate: c.registrationOpenDate || "",
    registrationCloseDate: c.registrationCloseDate || "",
    registration: R.registrationWindow(c),
    // For the list's banner and cards (20 Nov 2026): a line about it, who it's for, where.
    summary: summaryOf(c.description),
    ageMin: infoOf(c).ageMin ?? null,
    ageMax: infoOf(c).ageMax ?? null,
    mode: infoOf(c).mode || null,
    venue: infoOf(c).venue || "",
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
    const c = await PublicCompetitionService.findPublicRow(idOrSlug);
    if (!c) return null;

    const coursePricing = await resolveCoursePricing(arr(c.coursePricing), c.curriculumId);
    const tracks = arr(c.tracks);
    const slugs = R.trackSlugs(tracks);

    return {
      ...listItem(c),
      description: htmlToText(c.description),
      // The description as written (rich text) — the website shows it through its safeHtml.
      descriptionHtml: c.description || "",
      info: projectInfo(c),
      tracks: tracks.map((t, i) => projectTrack(c, t, i, slugs[i])),
      coursePricing,
    };
  },

  // The stored row behind a public id or slug (null when it isn't public) — also the
  // registration service's way in, so both read the same competition.
  async findPublicRow(idOrSlug) {
    const rows = await publicCompetitions();
    let c = rows.find((x) => x.id === idOrSlug) || null;
    if (!c) c = pickForSlug(rows.filter((x) => computedSlug(x) === idOrSlug));
    if (!c) return null;
    const parseJson = (v) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return null; } };
    return { ...c, tracks: arr(parseJson(c.tracks)), info: parseJson(c.info) || {}, coursePricing: parseJson(c.coursePricing) };
  },
};

module.exports = PublicCompetitionService;
