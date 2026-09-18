const db = require("../../../config/db");
const { generateId, toJson } = require("../../../shared/utils/model.utils");

const TABLE = "performance_bands";

// ageCategoryId is nullable at the DB level and must stay that way. A Progress-Arc-purpose band
// (pathwayId null) is required to have one by the Zod/service layer, but a Pathway
// band (pathwayId + courseId set — see findByPathway below) never has one and never
// should. Existing production data may already have Pathway bands, so a hard DB-level
// NOT NULL would break inserts for that unrelated feature.
const PerformanceBandModel = {
  findByCurriculum(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("order", "asc");
  },

  findById(id) {
    return db(TABLE).where({ id }).first();
  },

  // One Developmental Stage's own Progress-Arc ladder — excludes Pathway bands
  // implicitly, since those never carry an ageCategoryId. Ordered by this stage's own `order`
  // (1..N, independent of every other stage's numbering — see create/reorder below).
  findByCurriculumAndStage(curriculumId, ageCategoryId) {
    return db(TABLE).where({ curriculumId, ageCategoryId }).orderBy("order", "asc");
  },

  // Bands that form one Pathway's course ladder (pathwayId + courseId both set),
  // ordered by this pathway's own explicit `order` — the same authored sequence a course
  // reorder (see reorderByPathway below) writes, not a score-range walk (course-to-course
  // advancement is decided by indicator-contribution/threshold, see runIndicatorProgressEngine —
  // minScore/maxScore are no longer read for pathway bands).
  findByPathway(curriculumId, pathwayId) {
    return db(TABLE).where({ curriculumId, pathwayId }).whereNotNull("courseId").orderBy("order", "asc");
  },

  async create(curriculumId, fields) {
    const ageCategoryId = fields.ageCategoryId ?? null;
    const pathwayId = fields.pathwayId ?? null;
    // A Progress-Arc-purpose band is scoped to (curriculumId, ageCategoryId) so each stage's
    // ladder independently numbers 1..N. A Pathway band is scoped to (curriculumId, pathwayId)
    // instead — two different pathways must each number their own course sequence 1..N, not
    // share one counter (they'd otherwise collide once `order` actually decides course sequence,
    // rather than a plain score-range walk as before this changed).
    const counterScope = pathwayId ? { curriculumId, pathwayId } : { curriculumId, ageCategoryId };
    const [{ count }] = await db(TABLE).where(counterScope).count({ count: "*" });

    let order;
    if (fields.order != null) {
      // An explicit position (e.g. a band's fixed rank in the canonical Progress-Arc sequence —
      // see PERFORMANCE_BAND_SEQUENCE client-side) — clamp to a valid slot and shift anything
      // already at or after it up by one, so inserting "Explorer" at position 1 into a ladder
      // that already starts at 1 doesn't collide, it displaces.
      order = Math.max(1, Math.min(Number(fields.order), Number(count) + 1));
      await db(TABLE).where(counterScope).andWhere("order", ">=", order).increment("order", 1);
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
      pathwayId: fields.pathwayId ?? null,
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

  // A Pathway's own course ladder — called when the Pathway itself is deleted (see
  // CompetencyService.deletePathway), so its course-threshold bands don't sit orphaned.
  deleteByPathwayId(pathwayId) {
    return db(TABLE).where({ pathwayId }).del();
  },

  // Scoped to one stage's ladder — the { id, curriculumId, ageCategoryId } guard on each update
  // also prevents a caller from accidentally reordering a band belonging to a different stage.
  async reorder(curriculumId, ageCategoryId, orderedIds) {
    await Promise.all(orderedIds.map((id, i) => db(TABLE).where({ id, curriculumId, ageCategoryId }).update({ order: i + 1 })));
    return db(TABLE).where({ curriculumId, ageCategoryId }).orderBy("order", "asc");
  },

  // Same shape as reorder() above, scoped to one Pathway's course ladder instead of one
  // stage's — pathway bands all share ageCategoryId: null, so reusing reorder() as-is would let
  // two different pathways' orderedIds collide against each other. The { id, curriculumId,
  // pathwayId } guard on each update keeps this reorder from touching a band belonging to a
  // different pathway.
  async reorderByPathway(curriculumId, pathwayId, orderedIds) {
    await Promise.all(orderedIds.map((id, i) => db(TABLE).where({ id, curriculumId, pathwayId }).update({ order: i + 1 })));
    return db(TABLE).where({ curriculumId, pathwayId }).whereNotNull("courseId").orderBy("order", "asc");
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
