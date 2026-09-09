const AssessmentModel = require("../assessments/assessment.model");
const AssessmentInventoryLinkModel = require("../assessments/assessment-inventory-link.model");
const InventoryModel = require("../settings/inventory/inventory.model");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requirePublicContentAdminId, htmlToText } = require("../../shared/utils/public-content");

// The public marketing site's Projects section (digifunzi-landing's /projects) sells guided
// build projects. A "project" here is a `type: "project"` assessment authored in the portal's
// Assessment Builder and flipped to `saleStatus: "for_sale"` in its Selling panel. Only the
// designated PUBLIC_CONTENT_ADMIN_ID's for-sale projects are ever served — same tenant-scoping
// posture as public pathways / diagnostics (503 if that env var is unset).
//
// The projection is hand-built from a small, safe field set. The assessment's grading content
// (`items`, `rubric`, `indicators`, `indicatorMarks`, correct answers) is NEVER exposed — a
// buyer sees the marketing copy, the deliverables ("what you'll build"), the milestones (the
// steps) and the kit they'll need, nothing else.

// `assessments` has no slug column — computed at read time from `name`, same as pathways.
function computedSlug(assessment) {
  return slugify(assessment.name) || "project";
}

// Two of the admin's for-sale projects can share a computed slug (unlikely, but names aren't
// unique). Prefer the one with a cover image, then a price, then the first — deterministic so
// the list and a detail lookup agree.
function pickForSlug(matches) {
  if (matches.length <= 1) return matches[0] || null;
  return (
    matches.find((a) => a.coverImage) ||
    matches.find((a) => a.priceAmount != null) ||
    matches[0]
  );
}

function priceOf(assessment) {
  if (assessment.priceAmount == null) return null;
  return {
    amount: Number(assessment.priceAmount),
    currency: assessment.priceCurrency || "KES",
    note: assessment.priceNote || "",
  };
}

function listItem(assessment) {
  const deliverables = Array.isArray(assessment.deliverables) ? assessment.deliverables : [];
  const milestones = Array.isArray(assessment.milestones) ? assessment.milestones : [];
  return {
    id: assessment.id,
    slug: computedSlug(assessment),
    name: assessment.name,
    tagline: assessment.saleTagline || "",
    level: assessment.saleLevel || null,
    ageMin: assessment.ageMin ?? null,
    ageMax: assessment.ageMax ?? null,
    coverImage: toAbsoluteMediaUrl(assessment.coverImage),
    price: priceOf(assessment),
    deliverableCount: deliverables.length,
    milestoneCount: milestones.length,
  };
}

async function forSaleProjects() {
  const ownerAdminId = requirePublicContentAdminId();
  return AssessmentModel.findForSaleProjects(ownerAdminId);
}

const PublicProjectService = {
  // GET /api/public/projects — the designated admin's for-sale project assessments, newest
  // first, slug collisions collapsed to one representative each.
  async listProjects() {
    const projects = await forSaleProjects();

    const bySlug = new Map();
    for (const p of projects) {
      const slug = computedSlug(p);
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push(p);
    }
    return [...bySlug.values()]
      .map(pickForSlug)
      .filter(Boolean)
      .map(listItem)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  // GET /api/public/projects/:idOrSlug — list item + the full marketing detail: description +
  // overview (HTML flattened to text), deliverables, ordered milestones, and the kit the buyer
  // needs (from the assessment's linked inventory). Returns null (→ 404) for an unknown id/slug,
  // a project owned by a different admin, or one that isn't for sale.
  async getProject(idOrSlug) {
    const projects = await forSaleProjects();

    let project = projects.find((p) => p.id === idOrSlug) || null;
    if (!project) {
      project = pickForSlug(projects.filter((p) => computedSlug(p) === idOrSlug));
    }
    if (!project) return null;

    const deliverables = (Array.isArray(project.deliverables) ? project.deliverables : []).map((d) => ({
      name: d.name,
      description: d.description || "",
    }));
    const milestones = (Array.isArray(project.milestones) ? project.milestones : [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((m) => ({ name: m.name, description: m.description || "" }));

    // "What you'll need" — the physical kit linked to this project (Quarky robot, sensor pack…).
    let requirements = [];
    try {
      const links = await AssessmentInventoryLinkModel.findByAssessmentId(project.id);
      if (links.length) {
        const items = await InventoryModel.findByIds(links.map((l) => l.inventoryItemId));
        const byId = new Map(items.map((i) => [i.id, i]));
        requirements = links
          .map((l) => {
            const item = byId.get(l.inventoryItemId);
            if (!item) return null;
            return l.quantity > 1 ? `${item.name} ×${l.quantity}` : item.name;
          })
          .filter(Boolean);
      }
    } catch {
      /* inventory lookup hiccup — the detail page still renders without the kit list */
    }

    return {
      ...listItem(project),
      description: htmlToText(project.description),
      overview: htmlToText(project.overview),
      deliverables,
      milestones,
      requirements,
    };
  },
};

module.exports = PublicProjectService;
