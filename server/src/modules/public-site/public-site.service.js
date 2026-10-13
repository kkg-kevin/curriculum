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

// The designated admin's operational Pathways, across every curriculum they own.
// `pathways` has no ownerAdminId of its own — it's tenant-scoped transitively via
// curriculumId -> curricula.ownerAdminId (see the tenant-isolation migrations).
//
// Oldest curriculum first: when two curricula carry a pathway of the same name (a duplicated
// curriculum starts out with every one of the original's), the original's is the one the
// website keeps showing — see pickForSlug.
async function designatedAdminPathways() {
  const ownerAdminId = requirePublicContentAdminId();
  const curricula = (await CurriculumModel.findAll({ ownerAdminId }))
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
// the flag is on, an EFFECTIVE assessment (publicDiagnosticAssessmentId when set, falling back
// to diagnosticAssessmentId — same resolution public-diagnostic.service.js's
// loadOfferableAssessment uses) still resolves and is fully auto-gradable (live re-check — the
// flag and the assessment are independently editable), AND both age bounds are set on the
// pathway's own Developmental Stage (a missing bound means "not configured", not "any age" — the
// anonymous path fails safe). A pathway belongs to exactly one stage instead of carrying its own
// independent minAge/maxAge — see public-diagnostic.service.js's resolveEffectiveAgeRange for the
// same resolution.
async function diagnosticInfoFor(pathway) {
  const off = { available: false, minAge: null, maxAge: null };
  const effectiveAssessmentId = pathway?.publicDiagnosticAssessmentId || pathway?.diagnosticAssessmentId;
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

function listItem(resolved) {
  const pathway = resolved.stages[0]?.row || resolved.rows[0];
  return {
    id: pathway.id,
    slug: computedSlug(pathway),
    name: pathway.name,
    description: pathway.description || "",
    color: pathway.color || "#25476a",
    courseCount: resolved.courseCount,
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
  // { id, slug, name, description, color, courseCount }. A pathway with 0 active courses is
  // OMITTED — a visitor can't open it (its detail 404s) so listing it is just noise. When two
  // of the admin's pathways share a computed slug, only one appears (see pickForSlug).
  async listPathways() {
    const pathways = await designatedAdminPathways();

    // One entry per slug: a pathway's stages together, and slug collisions across curricula
    // collapsed to one representative (the "best" per pickForSlug).
    const slugs = [...new Set(pathways.map(computedSlug))];
    const chosen = (await Promise.all(slugs.map((slug) => pickForSlug(pathways, slug)))).filter(Boolean);

    return chosen
      .filter((c) => c.courseCount > 0)
      .map(listItem)
      .sort((a, b) => a.name.localeCompare(b.name));
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

    // `stages` is the pathway as authored: each Developmental Stage with its own courses and
    // diagnostic. `courses` and `diagnostic` stay as the flat, whole-pathway view (every stage's
    // courses youngest first; the diagnostic's ages spanning every stage that offers one).
    const offered = resolved.stages.map((s) => s.diagnostic).filter((d) => d.available);
    return {
      ...listItem(resolved),
      diagnostic: offered.length
        ? {
            available: true,
            minAge: Math.min(...offered.map((d) => d.minAge)),
            maxAge: Math.max(...offered.map((d) => d.maxAge)),
          }
        : { available: false, minAge: null, maxAge: null },
      courses: resolved.stages.flatMap((s) => s.courses.map(publicCourse)),
      stages: resolved.stages.map((s) => ({
        name: s.stage?.name || null,
        minAge: s.stage?.minAge ?? null,
        maxAge: s.stage?.maxAge ?? null,
        diagnostic: s.diagnostic,
        courses: s.courses.map(publicCourse),
      })),
    };
  },
};

module.exports = PublicSiteService;
