const CurriculumModel = require("../curriculum/curriculum.model");
const PathwayModel = require("../curriculum/competency-framework/pathway.model");
const CourseModel = require("../courses/course.model");
const AssessmentModel = require("../assessments/assessment.model");
const env = require("../../config/env");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requiresManualGrading } = require("../assessments/submissions/grading.utils");

// The public marketing site (digifunzi-landing) reads ONE designated admin's content — the
// admin whose `users.id` is in PUBLIC_CONTENT_ADMIN_ID. Every admin is an isolated tenant, so
// an anonymous visitor (no login) needs the backend told explicitly whose pathways to show.
// Unset → 503, the same "not configured" posture the diagnostic endpoints use.
function requirePublicContentAdminId() {
  if (!env.PUBLIC_CONTENT_ADMIN_ID) {
    const err = new Error("Public content is not configured");
    err.statusCode = 503;
    throw err;
  }
  return env.PUBLIC_CONTENT_ADMIN_ID;
}

// Course descriptions in the operational `courses` table are authored as rich-text HTML
// (TipTap). The landing site renders pathway course blurbs as plain text, so flatten tags
// and decode the handful of entities the editor emits before exposing them publicly.
function htmlToText(html) {
  if (!html) return "";
  return String(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// The designated admin's operational Pathways, across every curriculum they own.
// `pathways` has no ownerAdminId of its own — it's tenant-scoped transitively via
// curriculumId -> curricula.ownerAdminId (see the tenant-isolation migrations).
async function designatedAdminPathways() {
  const ownerAdminId = requirePublicContentAdminId();
  const curricula = await CurriculumModel.findAll({ ownerAdminId });
  const lists = await Promise.all(curricula.map((c) => PathwayModel.findByCurriculumId(c.id)));
  return lists.flat();
}

// Resolve a pathway's course id list to the still-active `courses` rows, IN LEARNING ORDER:
// courseSequence's saved order first (same rule the portal's own sequenceFor() / the
// authenticated learner-journey code uses — competency.service.js), then any courses[] entries
// that were never explicitly sequenced. Non-active / no-longer-resolving ids are dropped — the
// same "still exists" hygiene the reports code applies.
async function activeOrderedCourses(pathway) {
  const ids = Array.isArray(pathway.courses) ? pathway.courses : [];
  if (ids.length === 0) return [];
  const sequence = [...(pathway.courseSequence || [])].sort((a, b) => a.order - b.order);
  const sequencedIds = sequence.map((s) => s.courseId).filter((cid) => ids.includes(cid));
  const orderedIds = [...sequencedIds, ...ids.filter((cid) => !sequencedIds.includes(cid))];

  const rows = await Promise.all(orderedIds.map((id) => CourseModel.findById(id)));
  return orderedIds.map((id, i) => rows[i]).filter((c) => c && c.status === "active");
}

// Whether this pathway's diagnostic is actually offerable to an anonymous visitor right now:
// the flag is on, the assessment still resolves and is fully auto-gradable (live re-check —
// the flag and the assessment are independently editable), AND both age bounds are set (a
// missing bound means "not configured", not "any age" — the anonymous path fails safe).
async function diagnosticInfoFor(pathway) {
  const off = { available: false, minAge: null, maxAge: null };
  if (!pathway?.publicDiagnosticEnabled || !pathway.diagnosticAssessmentId) return off;
  if (pathway.minAge == null || pathway.maxAge == null || Number(pathway.minAge) > Number(pathway.maxAge)) {
    return off;
  }
  const assessment = await AssessmentModel.findById(pathway.diagnosticAssessmentId);
  if (!assessment || requiresManualGrading(assessment)) return off;
  return { available: true, minAge: Number(pathway.minAge), maxAge: Number(pathway.maxAge) };
}

// `pathways` has no slug column — the public contract needs one, computed at read time.
// Names are only unique WITHIN one curriculum, and the designated admin can own several
// curricula (e.g. "Digifunzi Competency Framework" + "sample program"), so two of their
// pathways can collide on the same computed slug. `pickForSlug` disambiguates: prefer a
// match that has active courses, then one with a public diagnostic, then the first.
function computedSlug(pathway) {
  return slugify(pathway.name) || "pathway";
}

async function pickForSlug(matches) {
  if (matches.length <= 1) return matches[0] || null;
  const withCounts = await Promise.all(
    matches.map(async (p) => ({ p, n: (await activeOrderedCourses(p)).length })),
  );
  return (
    withCounts.find((x) => x.n > 0)?.p ||
    matches.find((p) => p.publicDiagnosticEnabled) ||
    matches[0] ||
    null
  );
}

function listItem(pathway, courseCount) {
  return {
    id: pathway.id,
    slug: computedSlug(pathway),
    name: pathway.name,
    description: pathway.description || "",
    color: pathway.color || "#25476a",
    courseCount,
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

    // Collapse slug collisions to one representative each (the "best" per pickForSlug).
    const bySlug = new Map();
    for (const p of pathways) {
      const slug = computedSlug(p);
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push(p);
    }
    const chosen = (await Promise.all([...bySlug.values()].map(pickForSlug))).filter(Boolean);

    const counts = await Promise.all(chosen.map((p) => activeOrderedCourses(p)));
    return chosen
      .map((p, i) => ({ p, n: counts[i].length }))
      .filter(({ n }) => n > 0)
      .map(({ p, n }) => listItem(p, n))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  // Detail: list item + `diagnostic` + `courses` (resolved, still-active, in learning order).
  // Exactly name/description/ageMin/ageMax/coverImage per course — never the id or internal
  // fields. Returns null (→ 404) for an unknown id/slug, a pathway owned by a different admin,
  // or a pathway with no active courses left to show.
  async getPathway(idOrSlug) {
    const pathways = await designatedAdminPathways();

    let pathway = pathways.find((p) => p.id === idOrSlug) || null;
    if (!pathway) {
      pathway = await pickForSlug(pathways.filter((p) => computedSlug(p) === idOrSlug));
    }
    if (!pathway) return null;

    const courses = await activeOrderedCourses(pathway);
    if (courses.length === 0) return null;

    let diagnostic = { available: false, minAge: null, maxAge: null };
    try {
      diagnostic = await diagnosticInfoFor(pathway);
    } catch {
      /* assessment lookup hiccup — leave diagnostic unavailable, the page still renders */
    }

    return {
      ...listItem(pathway, courses.length),
      diagnostic,
      courses: courses.map((c) => ({
        name: c.name,
        description: htmlToText(c.description),
        ageMin: c.ageMin ?? null,
        ageMax: c.ageMax ?? null,
        // Absolutized — this projection is public-only (getPathway is never called by admin code).
        coverImage: toAbsoluteMediaUrl(c.coverImage),
      })),
    };
  },
};

module.exports = PublicSiteService;
