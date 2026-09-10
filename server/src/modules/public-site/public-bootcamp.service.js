const CurriculumModel = require("../curriculum/curriculum.model");
const ProgramModel = require("../programs/program.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requirePublicContentAdminId, htmlToText } = require("../../shared/utils/public-content");

// The public marketing site's Bootcamps section (digifunzi-landing's /bootcamps) sells short,
// intensive holiday/weekend programmes. A "bootcamp" here is a `curricula` row with
// `isProgram: true` (authored through the normal curriculum Basic Info → Structure →
// Competencies → Version Control flow, flagged a Program) that an admin flipped to
// `saleStatus: "for_sale"` in its Selling panel on the Program view. Only the designated
// PUBLIC_CONTENT_ADMIN_ID's for-sale program-curricula are ever served — same tenant-scoping
// posture as public pathways / projects / store (503 if that env var is unset).
//
// The projection is hand-built from a small, safe field set. The curriculum's structure,
// competency framework, course list and version content are NEVER exposed — a parent sees the
// marketing copy, the age range, the format, the price and (on detail) the upcoming runs.

// A program `curricula` row has no slug column — computed at read time from `name`, same as
// pathways / projects / store items.
function computedSlug(curriculum) {
  return slugify(curriculum.name) || "bootcamp";
}

// Two of the admin's for-sale bootcamps can share a computed slug (unlikely — curriculum names
// are unique per admin, but slugify collapses punctuation). Prefer the one with a cover image,
// then a price, then the first — deterministic so a list and a detail lookup agree.
function pickForSlug(matches) {
  if (matches.length <= 1) return matches[0] || null;
  return (
    matches.find((c) => c.coverImage) ||
    matches.find((c) => c.priceAmount != null) ||
    matches[0]
  );
}

function priceOf(curriculum) {
  if (curriculum.priceAmount == null) return null;
  return {
    amount: Number(curriculum.priceAmount),
    currency: curriculum.priceCurrency || "KES",
    note: curriculum.priceNote || "",
  };
}

// mysql2 auto-parses JSON columns on read, but a row that was never given one holds null.
function arr(value) {
  return Array.isArray(value) ? value : [];
}

function listItem(curriculum) {
  const highlights = arr(curriculum.highlights);
  return {
    id: curriculum.id,
    slug: computedSlug(curriculum),
    name: curriculum.name,
    tagline: curriculum.saleTagline || "",
    format: curriculum.saleFormat || null,
    duration: curriculum.durationLabel || "",
    ageMin: curriculum.ageMin ?? null,
    ageMax: curriculum.ageMax ?? null,
    coverImage: toAbsoluteMediaUrl(curriculum.coverImage),
    price: priceOf(curriculum),
    highlightCount: highlights.length,
  };
}

// Dates are plain "YYYY-MM-DD" strings throughout program.service.js and sort
// lexicographically the same as chronologically, so a direct string comparison is safe.
function deploymentStatus(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < String(startDate || "")) return "upcoming";
  if (today > String(endDate || "")) return "completed";
  return "active";
}

async function forSaleBootcamps() {
  const ownerAdminId = requirePublicContentAdminId();
  return CurriculumModel.findForSaleBootcamps(ownerAdminId);
}

// The still-relevant runs of a bootcamp — its Program deployments that haven't finished yet,
// soonest first, with the hub name resolved. Purely informational on the detail page ("next
// run: Nairobi, 14–25 Apr"); a bootcamp with no upcoming deployment still lists and sells (the
// "Enquire to book" lead is how a parent registers interest in the next run).
async function upcomingRuns(curriculumId) {
  const programs = await ProgramModel.findAll({ curriculumId });
  const live = programs.filter((p) => deploymentStatus(p.startDate, p.endDate) !== "completed");
  const hubs = await Promise.all(live.map((p) => LearningHubModel.findById(p.hubId)));
  return live
    .map((p, i) => ({
      hubName: hubs[i]?.name || null,
      startDate: p.startDate,
      endDate: p.endDate,
      status: deploymentStatus(p.startDate, p.endDate),
    }))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
}

const PublicBootcampService = {
  // GET /api/public/bootcamps — the designated admin's for-sale program-curricula, newest
  // first then by name, slug collisions collapsed to one representative each.
  async listBootcamps() {
    const bootcamps = await forSaleBootcamps();

    const bySlug = new Map();
    for (const b of bootcamps) {
      const slug = computedSlug(b);
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push(b);
    }
    return [...bySlug.values()]
      .map(pickForSlug)
      .filter(Boolean)
      .map(listItem)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  // GET /api/public/bootcamps/:idOrSlug — list item + the marketing detail: description
  // (rich-text HTML flattened to plain text), the "what you'll build" highlights, and the
  // upcoming runs. Returns null (→ 404) for an unknown id/slug, a bootcamp owned by a different
  // admin, or one that isn't for sale.
  async getBootcamp(idOrSlug) {
    const bootcamps = await forSaleBootcamps();

    let bootcamp = bootcamps.find((b) => b.id === idOrSlug) || null;
    if (!bootcamp) {
      bootcamp = pickForSlug(bootcamps.filter((b) => computedSlug(b) === idOrSlug));
    }
    if (!bootcamp) return null;

    let runs = [];
    try {
      runs = await upcomingRuns(bootcamp.id);
    } catch {
      /* deployment lookup hiccup — the detail page still renders without the runs list */
    }

    return {
      ...listItem(bootcamp),
      description: htmlToText(bootcamp.description),
      highlights: arr(bootcamp.highlights),
      upcomingRuns: runs,
    };
  },
};

module.exports = PublicBootcampService;
