const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../../shared/utils/model.utils");

// Same JSON columns as the real assessments table (modules/assessments/assessment.model.js) —
// kept in sync here even though create/update are currently unused, so this never becomes a
// silent-corruption trap if it's ever wired back up.
const JSON_FIELDS = ["sections", "items", "rubric", "indicators", "deliverables", "milestones"];

// LEGACY / NOT WIRED INTO SCORING: this is a plain name+type+description record, no
// items/rubric/indicatorMarks, so it can never feed the competency/Progress-Arc engines
// (grep-confirmed: nothing in scoring-engines.js or AssessmentSubmissionService reads it).
// It shares the same `assessments` table with the real assessment authoring system
// (modules/assessments/assessment.model.js — the one with indicator-linked items), just
// filtered by curriculumId presence, so don't confuse the two. Real assessments live there.
// The only live caller today is curriculum.service.js's deleteCurriculum cascade cleanup.
const TABLE = "assessments";

const AssessmentModel = {
  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("createdAt", "asc");
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

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },
};

module.exports = AssessmentModel;
