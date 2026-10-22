const { resolveMapPin } = require("../../shared/utils/map-pin");
const BootcampModel = require("../bootcamps/bootcamp.model");
const BootcampHubModel = require("../bootcamps/bootcamp-hub.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const PathwayModel = require("../curriculum/competency-framework/pathway.model");
const AgeCategoryModel = require("../curriculum/competency-framework/age-category.model");
const AssessmentModel = require("../assessments/assessment.model");
const GameService = require("../bootcamps/games/game.service");
const { requiresManualGrading } = require("../assessments/submissions/grading.utils");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requirePublicContentAdminId, htmlToText, resolveCoursePricing, resolveCurriculumSummary } = require("../../shared/utils/public-content");

// The public marketing site's Bootcamps section (digifunzi-landing's /bootcamps) sells short,
// intensive holiday/weekend programmes. A bootcamp is its own standalone `bootcamps` row
// (authored via the Bootcamps module, optionally linked to a curriculum via curriculumId)
// flipped to `saleStatus: "for_sale"`. Only the designated PUBLIC_CONTENT_ADMIN_ID's for-sale
// bootcamps are ever served — same tenant-scoping posture as public pathways / projects / store
// (503 if that env var is unset).
//
// The projection is hand-built from a small, safe field set. Internal fields (ownerAdminId,
// curriculumId) are never exposed as-is — a parent sees the marketing copy, the age range, the
// format, the price, the dates, and (on detail) the upcoming runs, course pricing, and a
// `curriculum` summary (name/description/competencies — see resolveCurriculumSummary) derived
// FROM curriculumId rather than the raw id itself.

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
    // Applies regardless of which pricing mode this bootcamp is in (whole-bootcamp price or
    // per-course) — kept top-level, not nested under `price`, since it must still render when
    // `price` is null (per-course pricing mode). See CreateBootcampPage.jsx.
    priceNotes: arr(bootcamp.priceNotes),
    highlightCount: highlights.length,
    startDate: bootcamp.startDate || null,
    endDate: bootcamp.endDate || null,
    registrationOpenDate: bootcamp.registrationOpenDate || null,
    registrationCloseDate: bootcamp.registrationCloseDate || null,
  };
}

// A game as the website sees it. `icon` (a key into the site's icon set) and `color` are the
// built-in picture every game has;
// `image` is the optional photo. Nothing internal (owner, timestamps) goes out.
function projectGame(game) {
  return {
    id: game.id,
    name: game.name,
    description: game.description || "",
    skills: arr(game.skills),
    icon: game.icon || "",
    color: game.color || "#25476a",
    image: toAbsoluteMediaUrl(game.image),
  };
}

// The games a bootcamp includes ("more than lessons"). A lookup hiccup just means no games
// section — the rest of the bootcamp still renders.
async function gamesOf(bootcamp) {
  try {
    return (await GameService.resolveForBootcamp(bootcamp.gameIds)).map(projectGame);
  } catch {
    return [];
  }
}

// Dates are plain "YYYY-MM-DD" strings throughout and sort lexicographically the same as
// chronologically, so a direct string comparison is safe.
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

function hubAddressOf(hub) {
  const a = hub?.address || {};
  return [a.street, a.city, a.county].filter(Boolean).join(", ");
}

// A space's rate/notes are data-capture-only fields from the admin's "Spaces, Capacity &
// Pricing" builder (no booking flow exists yet), but a family deciding whether to enquire
// about a specific space benefits from seeing them same as the admin does — so unlike the
// hub-level fields below, spaces are passed through close to as-is (minus its internal `id`).
function projectSpace(s) {
  return {
    name: s.name,
    spaceType: s.spaceType || "",
    building: s.building || "",
    floor: s.floor || "",
    room: s.room || "",
    minCapacity: s.minCapacity ?? null,
    maxCapacity: s.maxCapacity ?? null,
    pricingModel: s.pricingModel || "",
    rate: s.rate ?? null,
    priceUnit: s.priceUnit || "",
  };
}

// One running hub, projected for the public bootcamp page — deliberately richer than
// public-hub.service.js's own enrollment-picker projection (that one is explicit about staying
// narrow: "No email, no code..."), because the context here is different: a family already
// knows which specific hub their child's bootcamp runs at (it's named on a page they navigated
// to on purpose), not browsing an open directory — so surfacing how to actually reach that one
// hub (address, phone, contact person, photo, amenities, operating hours, its bookable spaces)
// is the useful thing to show, not a privacy risk. Still excludes anything truly internal
// (hubType, code, ownerAdminId, draft/inactive status, parentHubId, spaces[].id/reservable/notes).
function projectHub(hub) {
  return {
    id: hub.id,
    name: hub.name,
    // Authored as rich text (TipTap HTML); the landing site renders it as plain text.
    description: htmlToText(hub.description),
    address: hubAddressOf(hub),
    phone: hub.phone || "",
    email: hub.email || "",
    contactPerson: hub.contactPerson || "",
    mapLink: hub.mapLink || "",
    photo: toAbsoluteMediaUrl(hub.photo),
    photos: (hub.photos || []).map(toAbsoluteMediaUrl),
    amenities: hub.amenities || [],
    operatingHours: {
      opensAt: hub.operatingHours?.opensAt || "",
      closesAt: hub.operatingHours?.closesAt || "",
      days: hub.operatingHours?.days || [],
    },
    spaces: (hub.spaces || []).map(projectSpace),
  };
}

// A club's details for parents (learning_hubs.clubDetails, set in the hub form) — ages, when the
// club meets, class size, a description for parents, FAQs. Empty values come back empty so the
// website can simply leave out what isn't set.
const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
function projectClubDetails(details) {
  const d = details && typeof details === "object" ? details : {};
  const num = (v) => (Number.isInteger(v) ? v : null);
  return {
    ageMin: num(d.ageMin),
    ageMax: num(d.ageMax),
    classSize: num(d.classSize),
    sessions: (Array.isArray(d.sessions) ? d.sessions : [])
      .filter((x) => WEEK.includes(x?.day) && x.startsAt && x.endsAt)
      .map((x) => ({ day: x.day, startsAt: x.startsAt, endsAt: x.endsAt }))
      .sort((a, b) => WEEK.indexOf(a.day) - WEEK.indexOf(b.day) || a.startsAt.localeCompare(b.startsAt)),
    description: String(d.parentDescription || "").trim(),
    faqs: (Array.isArray(d.faqs) ? d.faqs : []).filter((f) => f?.question && f?.answer).map((f) => ({ question: f.question, answer: f.answer })),
  };
}

// The still-relevant runs of a bootcamp — every hub it currently runs at, with the hub itself
// resolved into the richer projectHub() shape above. Purely informational on the detail page
// ("this bootcamp runs at Nairobi, 14–25 Apr"); a bootcamp with no hub-offerings yet (or dates
// already past) still lists and sells — the "Enquire to book" lead is how a parent registers
// interest in the next run. Dates are uniform across every hub (they live on the bootcamp
// itself, not per hub), so this only needs the bootcamp record, not its curriculumId. A hub
// that's since gone inactive/been deleted is silently dropped rather than shown broken.
async function upcomingRuns(bootcamp) {
  if (!bootcamp?.startDate) return [];
  const status = deploymentStatus(bootcamp.startDate, bootcamp.endDate);
  if (status === "completed") return [];
  const offerings = await BootcampHubModel.findByBootcampId(bootcamp.id);
  const hubs = await Promise.all(offerings.map((o) => LearningHubModel.findById(o.hubId)));
  return offerings
    .map((o, i) => (hubs[i] ? { hub: projectHub(hubs[i]), startDate: bootcamp.startDate, endDate: bootcamp.endDate, status } : null))
    .filter(Boolean)
    .sort((a, b) => a.hub.name.localeCompare(b.hub.name));
}

// Resolves a for-sale bootcamp by id or computed slug — the exact same lookup getBootcamp()
// uses, exported so other public-site services (e.g. bootcamp-enrollment.service.js) can resolve
// "which bootcamp" identically rather than re-implementing the id/slug/tenant-scoping rules a
// second time and risking drift.
async function resolveForSaleBootcamp(idOrSlug) {
  const bootcamps = await forSaleBootcamps();
  let bootcamp = bootcamps.find((b) => b.id === idOrSlug) || null;
  if (!bootcamp) {
    bootcamp = pickForSlug(bootcamps.filter((b) => computedSlug(b) === idOrSlug));
  }
  return bootcamp;
}

// Whether a PATHWAY's own public diagnostic is actually offerable to an anonymous visitor right
// now — same check as public-site.service.js's diagnosticInfoFor, duplicated rather than
// imported (that function isn't exported, and this is a small pure check not worth adding
// cross-module coupling for — same posture the old bootcamp-wide diagnosticInfoFor took here).
//
// The bootcamp builder's pathwayDiagnostics[].assessmentId is NOT used here — a bootcamp can only
// offer a pathway's diagnostic when that pathway's OWN diagnosticAssessmentId/
// publicDiagnosticEnabled/age-range are independently set up as a public diagnostic (Curriculum →
// Competency Framework). This keeps the bootcamp flow a thin picker in front of the one, already
//-working /pathways/:slug/diagnostic flow rather than a second grading/attempt path.
//
// Returns the stage's age range ({ minAge, maxAge }) when offerable — the bootcamp "Enroll" flow
// picks the pathway from the child's age with it — and false otherwise.
async function pathwayDiagnosticOfferable(pathway) {
  // publicDiagnosticAssessmentId wins when set, falling back to diagnosticAssessmentId — same
  // "effective id" resolution public-diagnostic.service.js's loadOfferableAssessment uses, so a
  // pathway offering a different diagnostic publicly than its internal one is reflected here too.
  const effectiveAssessmentId = pathway?.publicDiagnosticAssessmentId || pathway?.diagnosticAssessmentId;
  if (!pathway?.publicDiagnosticEnabled || !effectiveAssessmentId) return false;
  // A pathway now belongs to exactly one Developmental Stage instead of carrying its own
  // independent minAge/maxAge — its stage's own age range is what gates public offerability
  // (same resolution public-diagnostic.service.js's resolveEffectiveAgeRange does).
  const stage = pathway.ageCategoryId ? await AgeCategoryModel.findById(pathway.ageCategoryId) : null;
  if (stage?.minAge == null || stage?.maxAge == null || Number(stage.minAge) > Number(stage.maxAge)) {
    return false;
  }
  const assessment = await AssessmentModel.findById(effectiveAssessmentId);
  if (!assessment || requiresManualGrading(assessment)) return false;
  return { minAge: Number(stage.minAge), maxAge: Number(stage.maxAge) };
}

// The bootcamp's pathwayDiagnostics, resolved to what the public "Take the diagnostic" picker
// needs: which of this bootcamp's pathways actually have an offerable public diagnostic right
// now, with the pathway's own slug (so the picker can link straight to
// /pathways/:slug/diagnostic) and display fields. A pathway assigned in the builder but whose OWN
// public diagnostic isn't set up (or no longer is) is silently dropped — see
// pathwayDiagnosticOfferable's comment for why the bootcamp's own assessmentId choice doesn't
// override this. Kept in the bootcamp's own order, with each pathway's age range: the website's
// Enroll button takes the first one whose range covers the child's age.
async function resolvePathwayDiagnostics(pathwayDiagnostics) {
  if (!pathwayDiagnostics || pathwayDiagnostics.length === 0) return [];
  const pathways = await Promise.all(pathwayDiagnostics.map((pd) => PathwayModel.findById(pd.pathwayId)));
  const offerable = await Promise.all(pathways.map((p) => (p ? pathwayDiagnosticOfferable(p) : false)));
  return pathways
    .map((pathway, i) => (pathway && offerable[i] ? { pathway, ages: offerable[i] } : null))
    .filter(Boolean)
    .map(({ pathway, ages }) => ({
      pathwayId: pathway.id,
      pathwaySlug: slugify(pathway.name) || "pathway",
      pathwayName: pathway.name,
      pathwayColor: pathway.color || null,
      minAge: ages.minAge,
      maxAge: ages.maxAge,
    }));
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
    const picked = [...bySlug.values()].map(pickForSlug).filter(Boolean);
    // Just enough of each bootcamp's games for a card to say "plus games: Chess, Monopoly…".
    const items = await Promise.all(picked.map(async (bootcamp) => ({
      ...listItem(bootcamp),
      games: (await gamesOf(bootcamp)).map(({ name, icon, color }) => ({ name, icon, color })),
    })));
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },

  // GET /api/public/bootcamps/:idOrSlug — list item + the marketing detail: description
  // (rich-text HTML flattened to plain text), the "what you'll build" highlights, and the
  // upcoming runs (only when the bootcamp has dates set). Returns null (→ 404) for an unknown
  // id/slug, a bootcamp owned by a different admin, or one that isn't for sale.
  async getBootcamp(idOrSlug) {
    const bootcamp = await resolveForSaleBootcamp(idOrSlug);
    if (!bootcamp) return null;

    let runs = [];
    try {
      runs = await upcomingRuns(bootcamp);
    } catch {
      /* offering lookup hiccup — the detail page still renders without the runs list */
    }

    const coursePricing = await resolveCoursePricing(arr(bootcamp.coursePricing), bootcamp.curriculumId, arr(bootcamp.pathwayIds));
    const curriculum = await resolveCurriculumSummary(bootcamp.curriculumId);

    let pathwayDiagnostics = [];
    try {
      pathwayDiagnostics = await resolvePathwayDiagnostics(arr(bootcamp.pathwayDiagnostics));
    } catch {
      /* pathway/assessment lookup hiccup — leave the list empty, the page still renders */
    }

    return {
      ...listItem(bootcamp),
      description: htmlToText(bootcamp.description),
      // The images after the cover, in the admin's order (the cover itself stays in coverImage).
      images: arr(bootcamp.images).map(toAbsoluteMediaUrl).filter(Boolean),
      highlights: arr(bootcamp.highlights),
      // The games and play that come with this bootcamp, in the admin's chosen order, and the
      // optional line on how play fits into the day. Empty/blank when the bootcamp has none.
      games: await gamesOf(bootcamp),
      gamesNote: bootcamp.gamesNote || "",
      upcomingRuns: runs,
      coursePricing,
      // The curriculum this bootcamp is built on, shown once for the whole bootcamp (every hub
      // run shares it) — see resolveCurriculumSummary's own comment for what's included/excluded.
      // null when the bootcamp has no linked curriculum at all.
      curriculum,
      // Which of this bootcamp's pathways currently offer a "Take the diagnostic" step — see
      // resolvePathwayDiagnostics. Empty when the bootcamp assigned none, or none of the assigned
      // pathways have their own public diagnostic switched on right now.
      pathwayDiagnostics,
    };
  },

  // GET /api/public/hubs/:id — the full profile for one hub, for the "Running at" list's own
  // detail page (BootcampDetailPage links out to it rather than only showing a dialog). Scoped
  // to the designated admin's active hubs only — same posture as everything else on this site;
  // a hub belonging to another admin, in draft/inactive status, or an unknown id all 404
  // undifferentiated so a probing client can't tell which. Deliberately NOT restricted to hubs
  // actually linked to a for-sale bootcamp's run — the id only ever reaches a visitor by way of
  // a bootcamp detail page that already listed it, so re-deriving that link here would just be
  // extra queries for no added safety.
  async getHub(id) {
    if (!id) return null;
    const ownerAdminId = requirePublicContentAdminId();
    const hub = await LearningHubModel.findById(id);
    if (!hub || hub.ownerAdminId !== ownerAdminId || hub.status !== "active") return null;
    // mapPin — where the hub's map link points ({ lat, lng }, or { query } with a place name, or
    // null), so the website's map pins the exact spot rather than geocoding the typed address.
    // Only on this one-hub profile; remembered per link for a day (shared/utils/map-pin.js).
    // clubDetails — what the Estate Tech Club page tells parents (ages, session times, FAQs); a
    // bootcamp's hub page simply doesn't use it.
    return { ...projectHub(hub), mapPin: await resolveMapPin(hub.mapLink), clubDetails: projectClubDetails(hub.clubDetails) };
  },
};

module.exports = PublicBootcampService;
// Exported alongside the default service object (not attached to it) so
// bootcamp-enrollment.service.js can resolve "which bootcamp" identically without
// re-implementing the id/slug/tenant-scoping rules — an internal helper, not a new public route.
module.exports.resolveForSaleBootcamp = resolveForSaleBootcamp;
