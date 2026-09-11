const BootcampModel = require("../bootcamps/bootcamp.model");
const EventModel = require("../events/event.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requirePublicContentAdminId, htmlToText } = require("../../shared/utils/public-content");

// The public marketing site's Bootcamps section (digifunzi-landing's /bootcamps) sells short,
// intensive holiday/weekend programmes. A bootcamp is its own standalone `bootcamps` row
// (authored via the Bootcamps module, optionally linked to an Event via eventId) flipped to
// `saleStatus: "for_sale"`. Only the designated PUBLIC_CONTENT_ADMIN_ID's for-sale bootcamps
// are ever served — same tenant-scoping posture as public pathways / projects / store (503 if
// that env var is unset).
//
// The projection is hand-built from a small, safe field set. Internal fields (ownerAdminId,
// eventId) are never exposed — a parent sees the marketing copy, the age range, the format,
// the price and (on detail) the upcoming runs.

// A bootcamp row has no slug column — computed at read time from `name`, same as
// pathways / projects / store items / competitions.
function computedSlug(bootcamp) {
  return slugify(bootcamp.name) || "bootcamp";
}

// Two of the admin's for-sale bootcamps can share a computed slug (unlikely — names aren't
// enforced unique here, but slugify collapses punctuation). Prefer the one with a cover image,
// then a price, then the first — deterministic so a list and a detail lookup agree.
function pickForSlug(matches) {
  if (matches.length <= 1) return matches[0] || null;
  return (
    matches.find((b) => b.coverImage) ||
    matches.find((b) => b.priceAmount != null) ||
    matches[0]
  );
}

function priceOf(bootcamp) {
  if (bootcamp.priceAmount == null) return null;
  return {
    amount: Number(bootcamp.priceAmount),
    currency: bootcamp.priceCurrency || "KES",
    note: bootcamp.priceNote || "",
  };
}

// mysql2 auto-parses JSON columns on read, but a row that was never given one holds null.
function arr(value) {
  return Array.isArray(value) ? value : [];
}

function listItem(bootcamp) {
  const highlights = arr(bootcamp.highlights);
  return {
    id: bootcamp.id,
    slug: computedSlug(bootcamp),
    name: bootcamp.name,
    tagline: bootcamp.tagline || "",
    format: bootcamp.format || null,
    duration: bootcamp.durationLabel || "",
    ageMin: bootcamp.ageMin ?? null,
    ageMax: bootcamp.ageMax ?? null,
    coverImage: toAbsoluteMediaUrl(bootcamp.coverImage),
    price: priceOf(bootcamp),
    highlightCount: highlights.length,
  };
}

// Dates are plain "YYYY-MM-DD" strings throughout event.service.js and sort
// lexicographically the same as chronologically, so a direct string comparison is safe.
function deploymentStatus(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < String(startDate || "")) return "upcoming";
  if (today > String(endDate || "")) return "completed";
  return "active";
}

async function forSaleBootcamps() {
  const ownerAdminId = requirePublicContentAdminId();
  return BootcampModel.findPublic(ownerAdminId);
}

// The still-relevant runs of a bootcamp — its linked Event's hub deployments that haven't
// finished yet, soonest first, with the hub name resolved. Purely informational on the detail
// page ("next run: Nairobi, 14–25 Apr"); a bootcamp with no linked Event (or no upcoming
// deployment) still lists and sells — the "Enquire to book" lead is how a parent registers
// interest in the next run.
async function upcomingRuns(eventId) {
  if (!eventId) return [];
  const events = await EventModel.findAll({ curriculumId: eventId });
  const live = events.filter((e) => deploymentStatus(e.startDate, e.endDate) !== "completed");
  const hubs = await Promise.all(live.map((e) => LearningHubModel.findById(e.hubId)));
  return live
    .map((e, i) => ({
      hubName: hubs[i]?.name || null,
      startDate: e.startDate,
      endDate: e.endDate,
      status: deploymentStatus(e.startDate, e.endDate),
    }))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
}

const PublicBootcampService = {
  // GET /api/public/bootcamps — the designated admin's for-sale bootcamps, newest first then
  // by name, slug collisions collapsed to one representative each.
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
  // upcoming runs (only when a linked Event exists). Returns null (→ 404) for an unknown
  // id/slug, a bootcamp owned by a different admin, or one that isn't for sale.
  async getBootcamp(idOrSlug) {
    const bootcamps = await forSaleBootcamps();

    let bootcamp = bootcamps.find((b) => b.id === idOrSlug) || null;
    if (!bootcamp) {
      bootcamp = pickForSlug(bootcamps.filter((b) => computedSlug(b) === idOrSlug));
    }
    if (!bootcamp) return null;

    let runs = [];
    try {
      runs = await upcomingRuns(bootcamp.eventId);
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
