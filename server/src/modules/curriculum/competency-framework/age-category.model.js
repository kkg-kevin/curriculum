const db = require("../../../config/db");
const { generateId, updateRecord, deleteRecord, firstOrNull, stringifyJsonFields, toJson } = require("../../../shared/utils/model.utils");

const TABLE = "age_categories";
const JSON_FIELDS = ["competencyIds", "indicatorContributions"];

const AgeCategoryModel = {
  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("order", "asc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  async create(data) {
    const [{ count }] = await db(TABLE).where({ curriculumId: data.curriculumId }).count({ count: "*" });
    const now = new Date();
    const item = { ...stringifyJsonFields(data, JSON_FIELDS), id: generateId(), order: Number(count) + 1, createdAt: now, updatedAt: now };
    await db(TABLE).insert(item);
    return { ...item, competencyIds: data.competencyIds || [], indicatorContributions: data.indicatorContributions || [] };
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },

  // A competency was deleted from the global catalog — strip it out of every stage's
  // competencyIds (and any indicatorContributions scored against it), across every curriculum,
  // so no stage is left referencing a dead id. Mirrors performance-band.model.js's
  // removeCompetencyFromAllBands exactly.
  async removeCompetencyFromAllStages(competencyId) {
    const stages = await db(TABLE);
    for (const stage of stages) {
      let changed = false;
      let competencyIds = stage.competencyIds || [];
      let indicatorContributions = stage.indicatorContributions || [];
      if (competencyIds.includes(competencyId)) {
        competencyIds = competencyIds.filter((id) => id !== competencyId);
        changed = true;
      }
      if (indicatorContributions.some((p) => p.competencyId === competencyId)) {
        indicatorContributions = indicatorContributions.filter((p) => p.competencyId !== competencyId);
        changed = true;
      }
      if (changed) {
        await db(TABLE).where({ id: stage.id }).update({
          competencyIds: toJson(competencyIds),
          indicatorContributions: toJson(indicatorContributions),
        });
      }
    }
  },
};

module.exports = AgeCategoryModel;
