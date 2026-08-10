const db = require("../../../config/db");
const { generateId, toJson } = require("../../../shared/utils/model.utils");

const TABLE = "performance_bands";

const PerformanceBandModel = {
  findByCurriculum(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("order", "asc");
  },

  // Bands that form one Learning Area's course ladder for Learning Journey (learningAreaId
  // + courseId both set), ordered by score range — lowest first.
  findByLearningArea(curriculumId, learningAreaId) {
    return db(TABLE).where({ curriculumId, learningAreaId }).whereNotNull("courseId").orderBy("minScore", "asc");
  },

  async create(curriculumId, fields) {
    const [{ count }] = await db(TABLE).where({ curriculumId }).count({ count: "*" });
    const band = {
      id: generateId(),
      curriculumId,
      name: fields.name,
      description: fields.description || "",
      minScore: fields.minScore ?? 0,
      maxScore: fields.maxScore ?? 100,
      competencyIds: toJson(fields.competencyIds || []),
      indicatorContributions: toJson(fields.indicatorContributions || []),
      advancementThreshold: fields.advancementThreshold ?? 0,
      learningAreaId: fields.learningAreaId ?? null,
      courseId: fields.courseId ?? null,
      order: Number(count) + 1,
      createdAt: new Date(),
    };
    await db(TABLE).insert(band);
    return { ...band, competencyIds: fields.competencyIds || [], indicatorContributions: fields.indicatorContributions || [] };
  },

  async update(curriculumId, id, fields) {
    const patch = { ...fields };
    if (patch.competencyIds !== undefined) patch.competencyIds = toJson(patch.competencyIds);
    if (patch.indicatorContributions !== undefined) patch.indicatorContributions = toJson(patch.indicatorContributions);
    const count = await db(TABLE).where({ id, curriculumId }).update(patch);
    if (count === 0) return null;
    return db(TABLE).where({ id }).first();
  },

  delete(curriculumId, id) {
    return db(TABLE).where({ id, curriculumId }).del();
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },

  async reorder(curriculumId, orderedIds) {
    await Promise.all(orderedIds.map((id, i) => db(TABLE).where({ id, curriculumId }).update({ order: i + 1 })));
    return db(TABLE).where({ curriculumId }).orderBy("order", "asc");
  },

  // A competency was deleted from the global catalog — strip it out of every band's
  // competencyIds (and any indicatorContributions scored against it), across every
  // curriculum, so no band is left referencing a dead id.
  async removeCompetencyFromAllBands(competencyId) {
    const bands = await db(TABLE);
    for (const band of bands) {
      let changed = false;
      let competencyIds = band.competencyIds || [];
      let indicatorContributions = band.indicatorContributions || [];
      if (competencyIds.includes(competencyId)) {
        competencyIds = competencyIds.filter((id) => id !== competencyId);
        changed = true;
      }
      if (indicatorContributions.some((p) => p.competencyId === competencyId)) {
        indicatorContributions = indicatorContributions.filter((p) => p.competencyId !== competencyId);
        changed = true;
      }
      if (changed) {
        await db(TABLE).where({ id: band.id }).update({
          competencyIds: toJson(competencyIds),
          indicatorContributions: toJson(indicatorContributions),
        });
      }
    }
  },
};

module.exports = PerformanceBandModel;
