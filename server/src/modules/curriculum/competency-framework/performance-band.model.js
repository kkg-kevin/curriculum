const db = require("../../../config/db");
const { generateId, toJson } = require("../../../shared/utils/model.utils");

const TABLE = "performance_bands";

// ageCategoryId is nullable at the DB level and must stay that way. A Progress-Arc-purpose band
// (learningAreaId null) is required to have one by the Zod/service layer, but a Learning-Journey
// band (learningAreaId + courseId set — see findByLearningArea below) never has one and never
// should. Existing production data may already have Learning-Journey bands, so a hard DB-level
// NOT NULL would break inserts for that unrelated feature.
const PerformanceBandModel = {
  findByCurriculum(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("order", "asc");
  },

  findById(id) {
    return db(TABLE).where({ id }).first();
  },

  // One Developmental Stage's own Progress-Arc ladder — excludes Learning-Journey bands
  // implicitly, since those never carry an ageCategoryId. Ordered by this stage's own `order`
  // (1..N, independent of every other stage's numbering — see create/reorder below).
  findByCurriculumAndStage(curriculumId, ageCategoryId) {
    return db(TABLE).where({ curriculumId, ageCategoryId }).orderBy("order", "asc");
  },

  // Bands that form one Learning Area's course ladder for Learning Journey (learningAreaId
  // + courseId both set), ordered by score range — lowest first.
  findByLearningArea(curriculumId, learningAreaId) {
    return db(TABLE).where({ curriculumId, learningAreaId }).whereNotNull("courseId").orderBy("minScore", "asc");
  },

  async create(curriculumId, fields) {
    const ageCategoryId = fields.ageCategoryId ?? null;
    // Scoped to (curriculumId, ageCategoryId) so each stage's ladder independently numbers 1..N.
    // Learning-Journey bands (ageCategoryId always null) keep sharing one counter per curriculum
    // exactly as before — they don't read `order` anyway, they sort by minScore.
    const [{ count }] = await db(TABLE).where({ curriculumId, ageCategoryId }).count({ count: "*" });

    let order;
    if (fields.order != null) {
      // An explicit position (e.g. a band's fixed rank in the canonical Progress-Arc sequence —
      // see PERFORMANCE_BAND_SEQUENCE client-side) — clamp to a valid slot and shift anything
      // already at or after it up by one, so inserting "Explorer" at position 1 into a ladder
      // that already starts at 1 doesn't collide, it displaces.
      order = Math.max(1, Math.min(Number(fields.order), Number(count) + 1));
      await db(TABLE).where({ curriculumId, ageCategoryId }).andWhere("order", ">=", order).increment("order", 1);
    } else {
      order = Number(count) + 1;
    }

    const band = {
      id: generateId(),
      curriculumId,
      name: fields.name,
      description: fields.description || "",
      minScore: fields.minScore ?? 0,
      maxScore: fields.maxScore ?? 100,
      competencyIds: toJson(fields.competencyIds || []),
      indicatorContributions: toJson(fields.indicatorContributions || []),
      // Range, not a single bar: advancementMin is a display-only "on track" floor,
      // advancementThreshold is the max that actually advances the learner (see
      // runIndicatorProgressEngine).
      advancementMin: fields.advancementMin ?? 0,
      advancementThreshold: fields.advancementThreshold ?? 0,
      learningAreaId: fields.learningAreaId ?? null,
      courseId: fields.courseId ?? null,
      ageCategoryId,
      order,
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

  // Scoped to one stage's ladder — the { id, curriculumId, ageCategoryId } guard on each update
  // also prevents a caller from accidentally reordering a band belonging to a different stage.
  async reorder(curriculumId, ageCategoryId, orderedIds) {
    await Promise.all(orderedIds.map((id, i) => db(TABLE).where({ id, curriculumId, ageCategoryId }).update({ order: i + 1 })));
    return db(TABLE).where({ curriculumId, ageCategoryId }).orderBy("order", "asc");
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
