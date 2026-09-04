const PathwayTemplateModel = require("../settings/pathways/pathway-template.model");
const CourseModel = require("../courses/course.model");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");

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

// Resolve a template's `courses` id array to the still-active `courses` rows, in the template's
// own order — that order IS the pathway's learning sequence. Same "still exists" hygiene the
// reports code applies: an id that no longer resolves, or a non-active course, is dropped.
async function activeCoursesForTemplate(template) {
  const ids = Array.isArray(template.courses) ? template.courses : [];
  if (ids.length === 0) return [];
  const rows = await Promise.all(ids.map((id) => CourseModel.findById(id)));
  return ids
    .map((id, i) => rows[i])
    .filter((c) => c && c.status === "active");
}

// pathway_templates has no slug column — the public contract needs one, so it's computed at read
// time with slugify(). The catalog enforces case-insensitive name uniqueness
// (pathway-template.service.js), so an exact slug clash is unlikely; no uniqueSlug()-style
// disambiguation is added here. :idOrSlug is resolved by findById first, then a findAll() scan
// for a matching computed slug (getPathway below).
function pathwayListItem(template, activeCount) {
  return {
    id: template.id,
    slug: slugify(template.name) || "pathway",
    name: template.name,
    description: template.description || "",
    color: template.color || "#25476a",
    courseCount: activeCount,
  };
}

const PublicSiteService = {
  // ---- Pathways (read-only) ----------------------------------------------------
  // List item shape: { id, slug, name, description, color, courseCount }.
  // courseCount counts only courses that still resolve to a real, active `courses` row —
  // same "still exists" hygiene the reports code applies.
  async listPathways() {
    const templates = await PathwayTemplateModel.findAll();
    const counts = await Promise.all(templates.map((t) => activeCoursesForTemplate(t)));
    return templates.map((t, i) => pathwayListItem(t, counts[i].length));
  },

  // Detail: list item + `courses` — the resolved, still-active course rows in pathway order.
  // Only name/description/ageMin/ageMax/coverImage are exposed per course; never the id or any
  // internal field. Returns null (→ 404) for an unknown id/slug, or a pathway with no active
  // courses left to show.
  async getPathway(idOrSlug) {
    let template = await PathwayTemplateModel.findById(idOrSlug);
    if (!template) {
      const all = await PathwayTemplateModel.findAll();
      template = all.find((t) => (slugify(t.name) || "pathway") === idOrSlug) || null;
    }
    if (!template) return null;

    const activeCourses = await activeCoursesForTemplate(template);
    if (activeCourses.length === 0) return null;

    return {
      ...pathwayListItem(template, activeCourses.length),
      courses: activeCourses.map((c) => ({
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
