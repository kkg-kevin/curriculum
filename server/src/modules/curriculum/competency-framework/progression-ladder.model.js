const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  firstOrNull,
  stringifyJsonFields,
  toJson,
} = require("../../../shared/utils/model.utils");

const TABLE = "progression_ladder_rungs";
const JSON_FIELDS = ["assignments"];

const ProgressionLadderModel = {
  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId });
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },

  // Cross-curriculum cleanup used when a competency is deleted from the global catalog —
  // strips it out of every rung's assignments, in every curriculum's ladder.
  async removeCompetencyFromAllRungs(competencyId) {
    const rungs = await db(TABLE);
    for (const rung of rungs) {
      const assignments = rung.assignments || [];
      const filtered = assignments.filter((a) => a.competencyId !== competencyId);
      if (filtered.length !== assignments.length) {
        await db(TABLE).where({ id: rung.id }).update({ assignments: toJson(filtered) });
      }
    }
  },
};

module.exports = ProgressionLadderModel;
