const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requirePublicContentAdminId, htmlToText } = require("../../shared/utils/public-content");

// Locations (25 Nov 2026) — the website's town pages ("Coding, robotics & AI classes for kids in
// Thika"), for searches that name a place. Everything on them is worked out from records staff
// already keep, nothing typed for the page:
//   - the places: the same hubs the website already shows (GET /api/public/hubs — the website
//     workspace's active, non-school hubs; each has its own page at /estate-tech-clubs/<slug>),
//     grouped by town (the hub address's city, else its county; online-only hubs = "Online");
//   - the bootcamps listed on the website with a run at one of those hubs that hasn't ended;
//   - the pathways on the website that run at one of them.
// GET /api/public/locations → every town; GET /api/public/locations/:slug → one, or 404.
// Nothing here is new information: each piece is already public on its own page.

const TYPE_LABELS = { co_working_space: "Co-working space", innovation_lab: "Innovation lab", makerspace: "Makerspace", tech_club: "Tech club" };
const DELIVERY_LABELS = { in_person: "In person", virtual: "Online", hybrid: "In person or online" };
const ONLINE = { town: "Online", slug: "online", county: "" };
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const clean = (v) => String(v || "").trim();

// Which town a hub belongs to on the website.
function townOf(hub) {
  if ((hub.deliveryMode || "in_person") === "virtual") return ONLINE;
  const a = hub.address || {};
  const town = clean(a.city) || clean(a.county);
  if (!town) return null;
  const county = clean(a.county) && clean(a.county) !== town ? clean(a.county) : "";
  return { town, slug: slugify(town), county };
}

// A hub as a town page shows it — the same public details its own page shows, in short.
function placeOf(hub) {
  const mode = hub.deliveryMode || "in_person";
  const a = hub.address || {};
  const h = hub.operatingHours || {};
  const summary = htmlToText(hub.description || "").replace(/\s+/g, " ").trim();
  return {
    id: hub.id,
    name: hub.name,
    // Its own page: /estate-tech-clubs/<slug> (the website and its pre-render slug names the same way).
    slug: slugify(hub.name),
    typeLabel: TYPE_LABELS[hub.hubType] || "",
    deliveryMode: mode,
    deliveryLabel: DELIVERY_LABELS[mode] || mode,
    address: mode === "virtual" ? "" : [a.street, a.city, a.county].map(clean).filter(Boolean).join(", "),
    mapLink: mode === "virtual" ? "" : clean(hub.mapLink),
    schedule: {
      days: DAY_ORDER.filter((d) => (Array.isArray(h.days) ? h.days : []).includes(d)),
      opensAt: h.opensAt || "",
      closesAt: h.closesAt || "",
    },
    // `logo` is the hub's own picture (learning_hubs.photo, the badge beside its name); `photos`
    // are of the space — the card shows the first, as on the Estate Tech Clubs page.
    logo: toAbsoluteMediaUrl(hub.photo || null),
    photos: (hub.photos || []).slice(0, 1).map(toAbsoluteMediaUrl).filter(Boolean),
    summary: summary.length > 220 ? `${summary.slice(0, 217).replace(/\s+\S*$/, "")}…` : summary,
  };
}

// What's on the website and where it runs: bootcamps (runs not ended) and pathways, each with the
// hub ids it runs at. Loaded once per request.
async function programmes() {
  const PublicBootcampService = require("./public-bootcamp.service");
  const PublicSiteService = require("./public-site.service");
  const [bootcampList, pathwayList] = await Promise.all([
    PublicBootcampService.listBootcamps().catch(() => []),
    PublicSiteService.listPathways().catch(() => []),
  ]);
  const bootcamps = (await Promise.all(bootcampList.map(async (item) => {
    const record = await PublicBootcampService.resolveForSaleBootcamp(item.slug);
    const runs = record ? await PublicBootcampService.upcomingRuns(record) : [];
    if (!runs.length) return null;
    return {
      slug: item.slug, name: item.name, tagline: item.tagline, audience: item.audience,
      ageMin: item.ageMin, ageMax: item.ageMax, startDate: item.startDate, endDate: item.endDate,
      coverImage: item.coverImage, hubIds: runs.map((r) => r.hub.id),
    };
  }))).filter(Boolean);
  const pathways = pathwayList.map((p) => ({
    slug: p.slug, name: p.name, image: p.image || null, from: p.subscription?.from ?? null,
    billingPeriod: p.subscription?.billingPeriod || null, hubIds: p.hubIds || [],
  }));
  return { bootcamps, pathways };
}

async function towns() {
  const ownerAdminId = requirePublicContentAdminId();
  const hubs = (await LearningHubModel.findAll({ ownerAdminId, status: "active" }))
    .filter((h) => h.hubType !== "school" && !h.isHomeLearning);
  const bySlug = new Map();
  for (const hub of hubs) {
    const where = townOf(hub);
    if (!where) continue;
    if (!bySlug.has(where.slug)) bySlug.set(where.slug, { ...where, places: [] });
    const entry = bySlug.get(where.slug);
    if (!entry.county && where.county) entry.county = where.county;
    entry.places.push(placeOf(hub));
  }
  if (!bySlug.size) return [];
  const { bootcamps, pathways } = await programmes();
  const runsHere = (list, ids) => list
    .filter((x) => x.hubIds.some((id) => ids.has(id)))
    .map(({ hubIds, ...rest }) => ({ ...rest, at: hubIds.filter((id) => ids.has(id)) }));
  const result = [...bySlug.values()].map((t) => {
    const ids = new Set(t.places.map((p) => p.id));
    const names = new Map(t.places.map((p) => [p.id, p.name]));
    const withNames = (items) => items.map(({ at, ...rest }) => ({ ...rest, places: (at || []).map((id) => names.get(id)) }));
    return {
      slug: t.slug,
      town: t.town,
      county: t.county,
      online: t.slug === ONLINE.slug,
      places: t.places.sort((a, b) => a.name.localeCompare(b.name)),
      bootcamps: withNames(runsHere(bootcamps, ids)),
      pathways: withNames(runsHere(pathways, ids)),
    };
  });
  // The most places first; Online last.
  return result.sort((a, b) => (a.online - b.online) || (b.places.length - a.places.length) || a.town.localeCompare(b.town));
}

const PublicLocationService = {
  // GET /api/public/locations
  list: towns,
  // GET /api/public/locations/:slug — null when there's no such town (→ 404).
  async get(slug) {
    const wanted = slugify(slug);
    return (await towns()).find((t) => t.slug === wanted) || null;
  },
};

module.exports = PublicLocationService;
module.exports._townOf = townOf;
