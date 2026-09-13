const env = require("../../config/env");
const CourseModel = require("../../modules/courses/course.model");
const PathwayModel = require("../../modules/curriculum/competency-framework/pathway.model");
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

// Resolves a bootcamp/competition's `coursePricing` ([{ courseId, priceAmount, priceCurrency }])
// into pathway-grouped, name-resolved sections for the public detail page — mirrors the admin
// side's CoursePricingDisplay.jsx grouping so a visitor sees the same "priced courses under
// their pathway" structure the admin set up. Each course carries the same fields
// PathwayRoadmap.jsx already renders for a pathway's course sequence (coverImage, age range,
// description) so the landing site can show priced courses as the identical numbered roadmap.
// A course whose id no longer resolves (deleted since pricing was set) is silently dropped
// rather than showing a broken row. Returns [] when there's nothing priced or no curriculum to
// group against.
async function resolveCoursePricing(coursePricing, curriculumId) {
  if (!Array.isArray(coursePricing) || coursePricing.length === 0 || !curriculumId) return [];

  const priceByCourseId = new Map(coursePricing.map((p) => [p.courseId, p]));
  const courses = await Promise.all(
    [...priceByCourseId.keys()].map((id) => CourseModel.findById(id))
  );
  const courseById = new Map(courses.filter(Boolean).map((c) => [c.id, c]));

  function priced(courseId) {
    const course = courseById.get(courseId);
    const price = priceByCourseId.get(courseId);
    if (!course || !price) return null;
    return {
      courseId,
      name: course.name,
      description: htmlToText(course.description),
      coverImage: toAbsoluteMediaUrl(course.coverImage),
      ageMin: course.ageMin ?? null,
      ageMax: course.ageMax ?? null,
      priceAmount: price.priceAmount ?? null,
      priceCurrency: price.priceCurrency || "KES",
    };
  }

  const pathways = await PathwayModel.findByCurriculumId(curriculumId);
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

  const ungrouped = [...priceByCourseId.keys()]
    .filter((id) => !groupedCourseIds.has(id))
    .map(priced)
    .filter(Boolean);
  if (ungrouped.length > 0) {
    sections.push({ pathwayId: null, pathwayName: null, pathwayColor: null, courses: ungrouped });
  }

  return sections;
}

module.exports = { requirePublicContentAdminId, htmlToText, resolveCoursePricing };
