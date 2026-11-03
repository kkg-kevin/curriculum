const CurriculumModel = require("../curriculum/curriculum.model");
const PathwayModel = require("../curriculum/competency-framework/pathway.model");
const AgeCategoryModel = require("../curriculum/competency-framework/age-category.model");
const PerformanceBandModel = require("../curriculum/competency-framework/performance-band.model");
const CourseModel = require("../courses/course.model");
const AssessmentModel = require("../assessments/assessment.model");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requiresManualGrading } = require("../assessments/submissions/grading.utils");
const { requirePublicContentAdminId, htmlToText } = require("../../shared/utils/public-content");
const PathwayTemplateModel = require("../settings/pathways/pathway-template.model");
const { pathwayPricing, coursePrice, isPriced } = require("../../shared/utils/pathway-pricing");
const LearningHubModel = require("../learning-hubs/learning-hub.model");

// Settings → Pathways → Website, per pathway name (the workspace's catalogue entries): whether the
// website shows it and the hubs it runs at. A pathway with no entry is shown, with no hubs.
async function websiteSettings() {
  const { websiteOf } = require("../settings/pathways/pathway-template.service");
  const entries = await PathwayTemplateModel.findAll({ ownerAdminId: requirePublicContentAdminId() });
  return new Map(entries.map((e) => [String(e.name || "").trim().toLowerCase(), { ...websiteOf(e), pricing: pathwayPricing(e), templateId: e.id }]));
}
const settingsFor = (settings, name) => settings.get(String(name || "").trim().toLowerCase()) || { visible: true, hubIds: [], image: null, pricing: pathwayPricing(null), templateId: null };

// The pathway's picture on the website: the one chosen in Settings → Pathways → Website, else the
// first course cover along the pathway (youngest stage first). null — the website draws its own.
function pathwayImage(website, resolved) {
  const own = website.image || resolved.stages.flatMap((s) => s.courses).find((c) => c.coverImage)?.coverImage;
  return own ? toAbsoluteMediaUrl(own) : null;
}

// Where a pathway runs, in short, for its card on the list: each town (or "Online") once.
function placesOf(hubs) {
  return [...new Set(hubs.map((h) => (h.town || h.name || "").split(",")[0].trim()).filter(Boolean))];
}

// What the website shows of a pathway's price: the whole price, or "from" its cheapest priced
// course (a family pays for the course the learner starts at). null when it isn't priced.
function priceSummary(pricing, resolved) {
  if (!isPriced(pricing)) return null;
  if (pricing.mode === "whole") return { mode: "whole", currency: pricing.currency, amount: pricing.amount };
  const ids = new Set(resolved.stages.flatMap((s) => s.courses.map((c) => c.id)));
  const prices = pricing.coursePrices.filter((p) => ids.has(p.courseId)).map((p) => p.amount);
  return prices.length ? { mode: "by_course", currency: pricing.currency, from: Math.min(...prices) } : null;
}

const DELIVERY_LABELS = { in_person: "In person", virtual: "Online", hybrid: "In person or online" };

// The hubs a pathway runs at, as the website shows them — still active ones only, in the order
// picked. Never anything internal beyond the hub's own public details.
// The hubs a pathway runs at: the ones ticked in Settings — or, for a priced pathway with none
// ticked, the active hubs that teach its curriculum (learning_hub_curricula), else every active hub
// of the website's workspace, so it can still be enrolled and paid for. Never the Home Learning
// holder.
async function effectiveHubIds(website, resolved) {
  if (website.hubIds.length || !isPriced(website.pricing)) return website.hubIds;
  const hubs = (await LearningHubModel.findAll({ ownerAdminId: requirePublicContentAdminId(), status: "active" }))
    .filter((h) => !h.isHomeLearning)
    .sort((a, b) => a.name.localeCompare(b.name));
  const curriculumIds = new Set((resolved?.rows || []).map((r) => r.curriculumId));
  const LinkModel = require("../learning-hubs/learning-hub-curriculum-link.model");
  const teaching = [];
  for (const hub of hubs) {
    if ((await LinkModel.findByHubId(hub.id)).some((l) => curriculumIds.has(l.curriculumId))) teaching.push(hub.id);
  }
  return teaching.length ? teaching : hubs.map((h) => h.id);
}

async function publicHubs(hubIds) {
  if (!hubIds.length) return [];
  const hubs = await Promise.all(hubIds.map((id) => LearningHubModel.findById(id)));
  return hubs
    .filter((h) => h && h.status === "active" && !h.isHomeLearning)
    .map((h) => {
      const deliveryMode = h.deliveryMode || "in_person";
      return {
        id: h.id, name: h.name, hubType: h.hubType, deliveryMode,
        deliveryLabel: DELIVERY_LABELS[deliveryMode] || deliveryMode,
        town: deliveryMode === "virtual" ? "Online" : [...new Set([h.address?.city, h.address?.county].map((x) => String(x || "").trim()).filter(Boolean))].join(", "),
      };
    });
}

// The designated admin's operational Pathways, across every curriculum they own.
// `pathways` has no ownerAdminId of its own — it's tenant-scoped transitively via
// curriculumId -> curricula.ownerAdminId (see the tenant-isolation migrations).
//
// Oldest curriculum first: when two curricula carry a pathway of the same name (a duplicated
// curriculum starts out with every one of the original's), the original's is the one the
// website keeps showing — see pickForSlug.
async function designatedAdminPathways() {
  const ownerAdminId = requirePublicContentAdminId();
  // A curriculum folded in from another admin (curricula.mergedFromAdminId, set by
  // scripts/mergeOrganisation.js) is left off the website: merging admins into one organisation
  // must not publish anything that wasn't public before.
  const curricula = (await CurriculumModel.findAll({ ownerAdminId }))
    .filter((c) => !c.mergedFromAdminId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const lists = await Promise.all(curricula.map((c) => PathwayModel.findByCurriculumId(c.id)));
  return lists.flat();
}

// Resolve a pathway's course id list to the still-active `courses` rows, IN LEARNING ORDER: the
// pathway's own authored course sequence — Performance Bands with pathwayId+courseId set,
// ordered by their `order` (see PerformanceBandModel.findByPathway; course-to-course advancement
// is now decided by indicator-contribution/threshold, not courseSequence/minScore) — then any
// courses[] entries that were never explicitly sequenced with a band. Non-active /
// no-longer-resolving ids are dropped — the same "still exists" hygiene the reports code applies.
async function activeOrderedCourses(pathway) {
  const ids = Array.isArray(pathway.courses) ? pathway.courses : [];
  if (ids.length === 0) return [];
  const bands = await PerformanceBandModel.findByPathway(pathway.curriculumId, pathway.id);
  const sequencedIds = bands.map((b) => b.courseId).filter((cid) => ids.includes(cid));
  const orderedIds = [...sequencedIds, ...ids.filter((cid) => !sequencedIds.includes(cid))];

  const rows = await Promise.all(orderedIds.map((id) => CourseModel.findById(id)));
  return orderedIds.map((id, i) => rows[i]).filter((c) => c && c.status === "active");
}

// Whether this pathway's diagnostic is actually offerable to an anonymous visitor right now:
// the flag is on, its website diagnostic (publicDiagnosticAssessmentId — same resolution
// public-diagnostic.service.js's loadOfferableAssessment uses) still resolves and is fully auto-gradable (live re-check — the
// flag and the assessment are independently editable), AND both age bounds are set on the
// pathway's own Developmental Stage (a missing bound means "not configured", not "any age" — the
// anonymous path fails safe). A pathway belongs to exactly one stage instead of carrying its own
// independent minAge/maxAge — see public-diagnostic.service.js's resolveEffectiveAgeRange for the
// same resolution.
async function diagnosticInfoFor(pathway) {
  const off = { available: false, minAge: null, maxAge: null };
  const effectiveAssessmentId = pathway?.publicDiagnosticAssessmentId;
  if (!pathway?.publicDiagnosticEnabled || !effectiveAssessmentId) return off;
  const stage = pathway.ageCategoryId ? await AgeCategoryModel.findById(pathway.ageCategoryId) : null;
  if (stage?.minAge == null || stage?.maxAge == null || Number(stage.minAge) > Number(stage.maxAge)) {
    return off;
  }
  const assessment = await AssessmentModel.findById(effectiveAssessmentId);
  if (!assessment || requiresManualGrading(assessment)) return off;
  return { available: true, minAge: Number(stage.minAge), maxAge: Number(stage.maxAge) };
}

// `pathways` has no slug column — the public contract needs one, computed at read time.
// Names are only unique WITHIN one curriculum, and the designated admin can own several
// curricula (e.g. "Digifunzi Competency Framework" + "sample program"), so two of their
// pathways can collide on the same computed slug. `pickForSlug` disambiguates: prefer a
// match that has active courses, then one with a public diagnostic, then the first.
//
// A pathway is one row per Developmental Stage, all sharing a name (see
// CompetencyService.createPathway). The website shows it as ONE pathway with its stages inside,
// so rows are first gathered per (curriculum, slug) — that's a pathway — and only then are
// same-slug pathways from different curricula collapsed to one.
function computedSlug(pathway) {
  return slugify(pathway.name) || "pathway";
}

// Every public pathway under `slug` resolved to { rows, stages, courseCount }: `stages` are the
// pathway's rows that still have active courses, youngest stage first (a row in no stage last),
// each with its stage, ordered courses and diagnostic info.
async function resolvePathway(rows) {
  const resolved = await Promise.all(
    rows.map(async (row) => {
      const stage = row.ageCategoryId ? await AgeCategoryModel.findById(row.ageCategoryId) : null;
      let diagnostic = { available: false, minAge: null, maxAge: null };
      try {
        diagnostic = await diagnosticInfoFor(row);
      } catch {
        /* assessment lookup hiccup — leave diagnostic unavailable, the page still renders */
      }
      return { row, stage, courses: await activeOrderedCourses(row), diagnostic };
    }),
  );
  const stages = resolved
    .filter((s) => s.courses.length > 0)
    .sort(
      (a, b) =>
        Number(!a.stage) - Number(!b.stage) ||
        (a.stage?.minAge ?? Infinity) - (b.stage?.minAge ?? Infinity) ||
        (a.stage?.name || "").localeCompare(b.stage?.name || ""),
    );
  return { rows, stages, courseCount: stages.reduce((n, s) => n + s.courses.length, 0) };
}

async function pickForSlug(pathways, slug) {
  const byCurriculum = new Map();
  for (const p of pathways) {
    if (computedSlug(p) !== slug) continue;
    if (!byCurriculum.has(p.curriculumId)) byCurriculum.set(p.curriculumId, []);
    byCurriculum.get(p.curriculumId).push(p);
  }
  // Candidates are oldest curriculum first (designatedAdminPathways). Among those with courses,
  // one that offers a public diagnostic wins, then the oldest.
  const candidates = await Promise.all([...byCurriculum.values()].map(resolvePathway));
  const offersDiagnostic = (c) => c.rows.some((p) => p.publicDiagnosticEnabled);
  return (
    candidates.find((c) => c.courseCount > 0 && offersDiagnostic(c)) ||
    candidates.find((c) => c.courseCount > 0) ||
    candidates.find(offersDiagnostic) ||
    candidates[0] ||
    null
  );
}

// A stage's address within its pathway (/pathways/:slug/:stageSlug on the website): its name made
// into a slug, unique within the pathway. A row with no stage is "other-courses". Never
// "diagnostic" — that address is the pathway's diagnostic.
function stageSlugs(stages) {
  const used = new Set(["diagnostic"]);
  return stages.map((s) => {
    const base = s.stage ? slugify(s.stage.name) || "stage" : "other-courses";
    let slug = base;
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  });
}

function listItem(resolved) {
  const pathway = resolved.stages[0]?.row || resolved.rows[0];
  const slugs = stageSlugs(resolved.stages);
  return {
    id: pathway.id,
    slug: computedSlug(pathway),
    name: pathway.name,
    description: pathway.description || "",
    color: pathway.color || "#25476a",
    courseCount: resolved.courseCount,
    // The developmental stages it runs through, youngest first (the website's stage pages).
    stages: resolved.stages.map((s, i) => ({
      slug: slugs[i],
      name: s.stage?.name || null,
      minAge: s.stage?.minAge ?? null,
      maxAge: s.stage?.maxAge ?? null,
      courseCount: s.courses.length,
    })),
  };
}

function publicCourse(c) {
  return {
    name: c.name,
    description: htmlToText(c.description),
    ageMin: c.ageMin ?? null,
    ageMax: c.ageMax ?? null,
    // Absolutized — this projection is public-only (getPathway is never called by admin code).
    coverImage: toAbsoluteMediaUrl(c.coverImage),
  };
}

const PublicSiteService = {
  // ---- Pathways (read-only) ----------------------------------------------------
  //
  // Serves the designated admin's OPERATIONAL pathways (Curriculum → Competency Framework) —
  // the same rows the portal authors, that carry the real courses, age range and diagnostic.
  // (Was previously the `pathway_templates` marketing catalog; that turned out to be a
  // separate, hand-maintained list that drifted from the actual curriculum. The
  // `pathway_templates` table and its `diagnosticPathwayId` link still exist for the portal's
  // own "reusable template" feature — the public site just no longer reads them.)
  //
  // Scoped to PUBLIC_CONTENT_ADMIN_ID (503 if unset). List item shape:
  // { id, slug, name, description, color, courseCount, stages, price, image, places, hubCount }. A pathway with 0 active courses is
  // OMITTED — a visitor can't open it (its detail 404s) so listing it is just noise. When two
  // of the admin's pathways share a computed slug, only one appears (see pickForSlug).
  async listPathways() {
    const pathways = await designatedAdminPathways();

    // One entry per slug: a pathway's stages together, and slug collisions across curricula
    // collapsed to one representative (the "best" per pickForSlug).
    const slugs = [...new Set(pathways.map(computedSlug))];
    const chosen = (await Promise.all(slugs.map((slug) => pickForSlug(pathways, slug)))).filter(Boolean);

    // Switched off in Settings → Pathways → Website: not on the website.
    const settings = await websiteSettings();
    const items = await Promise.all(
      chosen
        .filter((c) => c.courseCount > 0)
        .map(async (c) => {
          const item = listItem(c);
          const own = settingsFor(settings, item.name);
          if (!own.visible) return null;
          const hubs = await publicHubs(await effectiveHubIds(own, c));
          return { ...item, price: priceSummary(own.pricing, c), image: pathwayImage(own, c), places: placesOf(hubs), hubCount: hubs.length };
        }),
    );
    return items.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  },

  // Detail: list item + `diagnostic` + `courses` (resolved, still-active, in learning order).
  // Exactly name/description/ageMin/ageMax/coverImage per course — never the id or internal
  // fields. Returns null (→ 404) for an unknown id/slug, a pathway owned by a different admin,
  // or a pathway with no active courses left to show.
  async getPathway(idOrSlug) {
    const pathways = await designatedAdminPathways();

    // An id is one stage's row — it resolves to the whole pathway that row belongs to.
    const byId = pathways.find((p) => p.id === idOrSlug);
    const resolved = byId
      ? await resolvePathway(
          pathways.filter((p) => p.curriculumId === byId.curriculumId && computedSlug(p) === computedSlug(byId)),
        )
      : await pickForSlug(pathways, idOrSlug);
    if (!resolved || resolved.courseCount === 0) return null;
    const website = settingsFor(await websiteSettings(), (resolved.stages[0]?.row || resolved.rows[0])?.name);
    if (!website.visible) return null;
    // A course's own price under a per-course pathway (null otherwise).
    const priced = (c) => ({ ...publicCourse(c), price: coursePrice(website.pricing, c.id) });

    // `stages` is the pathway as authored: each Developmental Stage with its own courses and
    // diagnostic. `courses` and `diagnostic` stay as the flat, whole-pathway view (every stage's
    // courses youngest first; the diagnostic's ages spanning every stage that offers one).
    const offered = resolved.stages.map((s) => s.diagnostic).filter((d) => d.available);
    return {
      ...listItem(resolved),
      image: pathwayImage(website, resolved),
      diagnostic: offered.length
        ? {
            available: true,
            minAge: Math.min(...offered.map((d) => d.minAge)),
            maxAge: Math.max(...offered.map((d) => d.maxAge)),
          }
        : { available: false, minAge: null, maxAge: null },
      courses: resolved.stages.flatMap((s) => s.courses.map(priced)),
      // What it costs (Settings → Pathways → Website → Price) — null: an enquiry, not a paid enrolment.
      price: priceSummary(website.pricing, resolved),
      // Where it runs (Settings → Pathways → Website) — the family picks one when they enrol.
      hubs: await publicHubs(await effectiveHubIds(website, resolved)),
      stages: resolved.stages.map((s, i) => ({
        slug: stageSlugs(resolved.stages)[i],
        name: s.stage?.name || null,
        description: htmlToText(s.stage?.description || ""),
        minAge: s.stage?.minAge ?? null,
        maxAge: s.stage?.maxAge ?? null,
        diagnostic: s.diagnostic,
        courses: s.courses.map(priced),
      })),
    };
  },
};

module.exports = PublicSiteService;

// A website pathway enrolment (pathway-enrollment/) reads the pathway exactly as the website shows
// it: { name, slug, resolved: { rows, stages: [{ row, stage, courses }] }, website: { hubIds,
// pricing } } — null when it isn't on the website or has no courses.
module.exports.resolveForEnrolment = async function resolveForEnrolment(idOrSlug) {
  const pathways = await designatedAdminPathways();
  const byId = pathways.find((p) => p.id === idOrSlug);
  const resolved = byId
    ? await resolvePathway(pathways.filter((p) => p.curriculumId === byId.curriculumId && computedSlug(p) === computedSlug(byId)))
    : await pickForSlug(pathways, idOrSlug);
  if (!resolved || resolved.courseCount === 0) return null;
  const first = resolved.stages[0]?.row || resolved.rows[0];
  const website = settingsFor(await websiteSettings(), first?.name);
  if (!website.visible) return null;
  return { name: first.name, slug: computedSlug(first), resolved, website: { ...website, hubIds: await effectiveHubIds(website, resolved) } };
};
