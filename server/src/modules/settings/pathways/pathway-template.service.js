const PathwayTemplateModel = require("./pathway-template.model");
const CoursePathwayLinkModel = require("../../courses/course-pathway-link.model");
const AssessmentPathwayLinkModel = require("../../assessments/assessment-pathway-link.model");
const CourseModel = require("../../courses/course.model");
const db = require("../../../config/db");
const CurriculumModel = require("../../curriculum/curriculum.model");
const PathwayModel = require("../../curriculum/competency-framework/pathway.model");
const AgeCategoryModel = require("../../curriculum/competency-framework/age-category.model");
const LearningHubModel = require("../../learning-hubs/learning-hub.model");
const LearningHubCurriculumLinkModel = require("../../learning-hubs/learning-hub-curriculum-link.model");

const asList = (v) => (Array.isArray(v) ? v : typeof v === "string" && v ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []);
const townOf = (hub) => (hub.deliveryMode === "virtual" ? "Online" : [hub.address?.city, hub.address?.county].filter(Boolean).join(", "));

// The workspace's hubs a pathway can run at — active, not the Home Learning holder — each with
// the curricula it teaches (learning_hub_curricula), so Settings can put the ones already teaching
// the pathway's curriculum first.
async function workspaceHubs(ownerAdminId) {
  const hubs = (await LearningHubModel.findAll({ ownerAdminId, status: "active" })).filter((h) => !h.isHomeLearning);
  return Promise.all(hubs.map(async (h) => ({
    id: h.id, name: h.name, hubType: h.hubType, deliveryMode: h.deliveryMode || "in_person", town: townOf(h),
    curriculumIds: (await LearningHubCurriculumLinkModel.findByHubId(h.id)).map((l) => l.curriculumId),
  })));
}

const nameKey = (name) => String(name || "").trim().toLowerCase();
const { pathwayPricing } = require("../../../shared/utils/pathway-pricing");

// A Pathway's `courses` field stores course ids only — reject anything
// that doesn't resolve to a real course so a dummy id can never sneak in.
async function assertCoursesExist(courseIds) {
  if (!courseIds) return;
  const found = await Promise.all(courseIds.map((id) => CourseModel.findById(id)));
  const missing = courseIds.filter((id, i) => !found[i]);
  if (missing.length > 0) {
    const err = new Error(`Course(s) not found: ${missing.join(", ")}`);
    err.statusCode = 404;
    throw err;
  }
}

// A catalogue entry's website settings — shown unless switched off (no entry: shown, no hubs).
function websiteOf(entry) {
  return { visible: entry ? entry.websiteVisible !== false && entry.websiteVisible !== 0 : true, hubIds: asList(entry?.websiteHubIds) };
}

const PathwayTemplateService = {
  websiteOf,
  asList,
  async getPathways(ownerAdminId) {
    return PathwayTemplateModel.findAll({ ownerAdminId });
  },

  // Settings → Pathways: the workspace's actual pathways, to look at — the ones its curricula run
  // (Curriculum → Competency Framework → Pathways, one row per developmental stage, rows of the
  // same name being one pathway), each with the curricula using it, its courses per stage and how
  // many learners are on it; then catalogue entries no curriculum uses yet ("Not in use"), with
  // their courses. Nothing is edited here — a pathway is added to, or changed in, a curriculum.
  async getDirectory(ownerAdminId) {
    const curricula = await CurriculumModel.findAll({ ownerAdminId });
    const [templates, courses] = await Promise.all([
      PathwayTemplateModel.findAll({ ownerAdminId }),
      CourseModel.findAll({ ownerAdminId }),
    ]);
    const courseName = new Map(courses.map((c) => [c.id, c.name]));
    const coursesOf = (ids) => (Array.isArray(ids) ? ids : []).filter((id) => courseName.has(id)).map((id) => ({ id, name: courseName.get(id) }));

    const byName = new Map();
    for (const curriculum of curricula) {
      const [rows, stages] = await Promise.all([PathwayModel.findByCurriculumId(curriculum.id), AgeCategoryModel.findByCurriculumId(curriculum.id)]);
      const stageById = new Map(stages.map((s) => [s.id, s]));
      for (const row of rows) {
        const key = nameKey(row.name);
        if (!byName.has(key)) byName.set(key, { key, name: row.name, color: row.color, description: row.description || "", rowIds: [], curricula: new Map() });
        const entry = byName.get(key);
        entry.rowIds.push(row.id);
        if (!entry.curricula.has(curriculum.id)) entry.curricula.set(curriculum.id, { curriculumId: curriculum.id, curriculumName: curriculum.name, stages: [] });
        const stage = row.ageCategoryId ? stageById.get(row.ageCategoryId) : null;
        entry.curricula.get(curriculum.id).stages.push({
          stageName: stage?.name || null, minAge: stage?.minAge ?? row.minAge ?? null, maxAge: stage?.maxAge ?? row.maxAge ?? null,
          courses: coursesOf(row.courses),
        });
      }
    }

    const allRowIds = [...byName.values()].flatMap((e) => e.rowIds);
    const learnerRows = allRowIds.length ? await db("learner_pathways").whereIn("pathwayId", allRowIds).select("pathwayId", "learnerId") : [];
    const templateByName = new Map(templates.map((tpl) => [nameKey(tpl.name), tpl]));

    const inUse = [...byName.values()].map((e) => {
      const ids = new Set(e.rowIds);
      const curriculaList = [...e.curricula.values()].map((c) => ({
        ...c,
        stages: c.stages.sort((a, b) => (a.minAge ?? 99) - (b.minAge ?? 99)),
      }));
      return {
        key: e.key, name: e.name, color: e.color || "#25476a", description: e.description,
        inUse: true,
        templateId: templateByName.get(e.key)?.id || null,
        website: websiteOf(templateByName.get(e.key)),
        pricing: pathwayPricing(templateByName.get(e.key)),
        curricula: curriculaList,
        courseCount: new Set(curriculaList.flatMap((c) => c.stages.flatMap((s) => s.courses.map((x) => x.id)))).size,
        learnerCount: new Set(learnerRows.filter((r) => ids.has(r.pathwayId)).map((r) => r.learnerId)).size,
      };
    });
    const notInUse = templates
      .filter((tpl) => !byName.has(nameKey(tpl.name)))
      .map((tpl) => ({
        key: nameKey(tpl.name), name: tpl.name, color: tpl.color || "#25476a", description: tpl.description || "",
        inUse: false, templateId: tpl.id, curricula: [], website: websiteOf(tpl), pricing: pathwayPricing(tpl),
        courses: coursesOf(tpl.courses), courseCount: coursesOf(tpl.courses).length, learnerCount: 0,
      }));
    const pathways = [...inUse, ...notInUse].sort((a, b) => (a.inUse === b.inUse ? a.name.localeCompare(b.name) : a.inUse ? -1 : 1));
    return { pathways, hubs: (await workspaceHubs(ownerAdminId)).sort((a, b) => a.name.localeCompare(b.name)) };
  },

  // Settings → Pathways → Website → Price: none (an enquiry), the whole pathway, or each course.
  // Course prices may only name real courses; an empty amount drops that course's price.
  async setPricing(id, { mode, priceAmount, currency, coursePrices }, ownerAdminId) {
    const entry = await PathwayTemplateModel.findById(id);
    if (!entry || entry.ownerAdminId !== ownerAdminId) {
      const err = new Error("Pathway not found");
      err.statusCode = 404;
      throw err;
    }
    if (mode === "whole" && (priceAmount == null || priceAmount < 0)) {
      const err = new Error("Enter the pathway's price");
      err.statusCode = 400;
      throw err;
    }
    const prices = (coursePrices || []).filter((p) => p.amount != null);
    if (mode === "by_course" && prices.length === 0) {
      const err = new Error("Give at least one course a price");
      err.statusCode = 400;
      throw err;
    }
    await assertCoursesExist(prices.map((p) => p.courseId));
    await PathwayTemplateModel.update(id, {
      pricingMode: mode,
      priceAmount: mode === "whole" ? priceAmount : null,
      priceCurrency: currency || "KES",
      coursePrices: mode === "by_course" ? prices : [],
    });
    return pathwayPricing(await PathwayTemplateModel.findById(id));
  },

  // Settings → Pathways → Website: whether the website shows this pathway, and the hubs it runs at
  // (the website lists them; the family picks one when they enrol). Every hub must be one of this
  // workspace's active hubs.
  async setWebsite(id, { visible, hubIds }, ownerAdminId) {
    const entry = await PathwayTemplateModel.findById(id);
    if (!entry || entry.ownerAdminId !== ownerAdminId) {
      const err = new Error("Pathway not found");
      err.statusCode = 404;
      throw err;
    }
    const allowed = new Set((await workspaceHubs(ownerAdminId)).map((h) => h.id));
    const unknown = (hubIds || []).filter((h) => !allowed.has(h));
    if (unknown.length) {
      const err = new Error("One of those hubs isn't an active hub in your workspace");
      err.statusCode = 400;
      throw err;
    }
    await PathwayTemplateModel.update(id, { websiteVisible: Boolean(visible), websiteHubIds: [...new Set(hubIds || [])] });
    return websiteOf(await PathwayTemplateModel.findById(id));
  },

  async createPathway(data) {
    const existing = await PathwayTemplateModel.findAll({ ownerAdminId: data.ownerAdminId });
    if (existing.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("A pathway with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    await assertCoursesExist(data.courses);
    return PathwayTemplateModel.create(data);
  },

  async updatePathway(id, data, ownerAdminId) {
    const template = await PathwayTemplateModel.findById(id);
    if (!template) {
      const err = new Error("Pathway template not found");
      err.statusCode = 404;
      throw err;
    }
    if (template.ownerAdminId !== ownerAdminId) {
      const err = new Error("You do not have permission to access this record");
      err.statusCode = 403;
      throw err;
    }
    if (data.name) {
      const all = await PathwayTemplateModel.findAll({ ownerAdminId });
      const others = all.filter((a) => a.id !== id);
      if (others.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("A pathway with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    await assertCoursesExist(data.courses);
    return PathwayTemplateModel.update(id, data);
  },

  async deletePathway(id, ownerAdminId) {
    const template = await PathwayTemplateModel.findById(id);
    if (!template) {
      const err = new Error("Pathway template not found");
      err.statusCode = 404;
      throw err;
    }
    if (template.ownerAdminId !== ownerAdminId) {
      const err = new Error("You do not have permission to access this record");
      err.statusCode = 403;
      throw err;
    }
    await PathwayTemplateModel.delete(id);
    // Deleting the template does not touch copies already imported into
    // curricula — those are independent records (see curriculum pathway.model.js).
    // Courses/Assessments only ever reference the catalog by id (never copy it), so
    // those references must be cleaned up here or they'd point at a dead id.
    await CoursePathwayLinkModel.deleteByPathwayId(id);
    await AssessmentPathwayLinkModel.deleteByPathwayId(id);
  },
};

module.exports = PathwayTemplateService;
