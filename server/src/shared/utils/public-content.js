const env = require("../../config/env");
const CourseModel = require("../../modules/courses/course.model");
const ModuleModel = require("../../modules/courses/module.model");
const PathwayModel = require("../../modules/curriculum/competency-framework/pathway.model");
const CurriculumModel = require("../../modules/curriculum/curriculum.model");
const CurriculumCompetencyLinkModel = require("../../modules/curriculum/competency-framework/curriculum-competency-link.model");
const CompetencyModel = require("../../modules/settings/competencies/competency.model");
const { toAbsoluteMediaUrl } = require("./media-url");

// The public marketing site (digifunzi-landing) reads ONE designated admin's content — the
// admin whose `users.id` is in PUBLIC_CONTENT_ADMIN_ID. Every admin is an isolated tenant, so
// an anonymous visitor (no login) needs the backend told explicitly whose content to show.
// Unset → 503, the "not configured" posture every public endpoint uses. Shared by
// public-site.service.js (pathways) and public-project.service.js (for-sale projects).
function requirePublicContentAdminId() {
  if (!env.PUBLIC_CONTENT_ADMIN_ID) {
    const err = new Error("Public content is not configured");
    err.statusCode = 503;
    throw err;
  }
  return env.PUBLIC_CONTENT_ADMIN_ID;
}

// Rich-text fields (course/pathway/project descriptions, project overview) are authored as
// TipTap HTML. The landing site renders these as plain text, so flatten tags and decode the
// handful of entities the editor emits before exposing them publicly.
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

// Resolves a bootcamp/competition's `coursePricing`
// ([{ courseId, priceAmount, priceCurrency, modulePricing }]) into pathway-grouped, name-resolved
// sections for the public detail page — mirrors the admin side's CoursePricingDisplay.jsx
// grouping so a visitor sees the same "priced courses under their pathway" structure the admin
// set up. Each course carries the same fields PathwayRoadmap.jsx already renders for a pathway's
// course sequence (coverImage, age range, description) so the landing site can show priced
// courses as the identical numbered roadmap.
//
// `modulePricing` (the per-course "priced by module instead" addition — see
// bootcamp.validation.js's coursePriceSchema) resolves to a `modules` array on that course's
// entry: [{ id, name, priceAmount, priceCurrency }]. Modules have no description/coverImage/age
// range of their own (course_modules only has name + order), so that's all there is to show.
// When a course is priced by module, its own top-level priceAmount is null (see
// assertCourseEntryPricingValid — the two are mutually exclusive), so the landing site knows to
// render the module breakdown instead of one course-wide price.
//
// A course/module whose id no longer resolves (deleted since pricing was set) is silently dropped
// rather than showing a broken row. Returns [] when there's nothing priced or no curriculum to
// group against.
//
// `pathwayIds`, when non-empty, scopes this to just those pathways (a bootcamp's own choice of
// which of its curriculum's pathways it actually runs — see bootcamp.validation.js). A priced
// course whose only pathway isn't in that list is dropped entirely, including from the ungrouped
// "ownerless course" fallback — there's no pathway left to attribute it to. Empty/undefined
// pathwayIds keeps the original "every pathway under the curriculum" behaviour.
async function resolveCoursePricing(coursePricing, curriculumId, pathwayIds) {
  if (!Array.isArray(coursePricing) || coursePricing.length === 0 || !curriculumId) return [];
  const scoped = Array.isArray(pathwayIds) && pathwayIds.length > 0;
  const scopedIds = scoped ? new Set(pathwayIds) : null;

  const priceByCourseId = new Map(coursePricing.map((p) => [p.courseId, p]));
  const courses = await Promise.all(
    [...priceByCourseId.keys()].map((id) => CourseModel.findById(id))
  );
  const courseById = new Map(courses.filter(Boolean).map((c) => [c.id, c]));

  // Only fetched for courses actually priced by module — most courses are priced as a whole and
  // never need a module lookup at all.
  const modulePricedCourseIds = [...priceByCourseId.values()]
    .filter((p) => (p.modulePricing || []).length > 0)
    .map((p) => p.courseId);
  const moduleListsByCourse = await Promise.all(modulePricedCourseIds.map((id) => ModuleModel.findByCourseId(id)));
  const modulesByCourseId = new Map(modulePricedCourseIds.map((id, i) => [id, moduleListsByCourse[i]]));

  function pricedModules(courseId, modulePricing) {
    const priceByModuleId = new Map(modulePricing.map((p) => [p.moduleId, p]));
    const modules = modulesByCourseId.get(courseId) || [];
    return modules
      .filter((m) => priceByModuleId.has(m.id))
      .map((m) => {
        const price = priceByModuleId.get(m.id);
        return { id: m.id, name: m.name, priceAmount: price.priceAmount ?? null, priceCurrency: price.priceCurrency || "KES" };
      });
  }

  function priced(courseId) {
    const course = courseById.get(courseId);
    const price = priceByCourseId.get(courseId);
    if (!course || !price) return null;
    const modulePricing = price.modulePricing || [];
    return {
      courseId,
      name: course.name,
      description: htmlToText(course.description),
      coverImage: toAbsoluteMediaUrl(course.coverImage),
      ageMin: course.ageMin ?? null,
      ageMax: course.ageMax ?? null,
      priceAmount: price.priceAmount ?? null,
      priceCurrency: price.priceCurrency || "KES",
      modules: modulePricing.length > 0 ? pricedModules(courseId, modulePricing) : [],
    };
  }

  const allPathways = await PathwayModel.findByCurriculumId(curriculumId);
  const pathways = scoped ? allPathways.filter((p) => scopedIds.has(p.id)) : allPathways;
  const groupedCourseIds = new Set();
  const sections = [];

  for (const pathway of pathways) {
    // courseSequence (when set) is the pathway's authored learning order — same ordering
    // PathwayRoadmap.jsx numbers on the public pathway page. Fall back to `courses`' own order
    // for a pathway that hasn't set a sequence.
    const orderedIds = Array.isArray(pathway.courseSequence) && pathway.courseSequence.length > 0
      ? pathway.courseSequence
      : (pathway.courses || []);
    const items = orderedIds
      .filter((id) => priceByCourseId.has(id))
      .map(priced)
      .filter(Boolean);
    if (items.length === 0) continue;
    items.forEach((item) => groupedCourseIds.add(item.courseId));
    sections.push({ pathwayId: pathway.id, pathwayName: pathway.name, pathwayColor: pathway.color || null, courses: items });
  }

  if (!scoped) {
    const ungrouped = [...priceByCourseId.keys()]
      .filter((id) => !groupedCourseIds.has(id))
      .map(priced)
      .filter(Boolean);
    if (ungrouped.length > 0) {
      sections.push({ pathwayId: null, pathwayName: null, pathwayColor: null, courses: ungrouped });
    }
  }

  return sections;
}

// Resolves a bootcamp/competition's curriculumId into a small public-safe summary: the
// curriculum's own name/description plus the competencies it has adopted (see
// curriculum-competency-link.model.js — a curriculum no longer authors competencies, it just
// links to entries in the shared, tenant-wide catalog). Shown once per bootcamp/competition
// page (every hub run shares the same curriculum), not per run.
//
// Deliberately calls the link/competency MODELS directly rather than going through
// competency.service.js's getCurriculumCompetencies — that service file pulls in a long chain of
// scoring-engine/versioning/learner-pathway dependencies meant for the admin-authoring surface,
// none of which this read-only public projection needs.
//
// Field selection mirrors public-diagnostic.service.js's existing posture on exposing
// competencies publicly (buildIndicatorMeta's comment: "plain display strings, not sensitive/
// scoped data"): name/description are shown, `minimumThreshold` (curriculum-specific scoring
// config, not marketing content) and indicator-level detail are left out.
async function resolveCurriculumSummary(curriculumId) {
  if (!curriculumId) return null;
  const curriculum = await CurriculumModel.findById(curriculumId);
  if (!curriculum) return null;

  const links = await CurriculumCompetencyLinkModel.findByCurriculumId(curriculumId);
  const competencies = await CompetencyModel.findByIds(links.map((l) => l.competencyId));

  return {
    name: curriculum.name,
    description: htmlToText(curriculum.description),
    competencies: competencies
      .map((c) => ({ id: c.id, name: c.name, description: htmlToText(c.description) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

module.exports = { requirePublicContentAdminId, htmlToText, resolveCoursePricing, resolveCurriculumSummary };
