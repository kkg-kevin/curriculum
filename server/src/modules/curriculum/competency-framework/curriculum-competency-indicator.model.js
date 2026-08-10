const db = require("../../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "curriculum_competency_indicators";

// Indicators describe how THIS curriculum evaluates a competency it has adopted —
// two curricula using the same global competency can define different indicators.
// NOT WIRED INTO SCORING: records here get fresh ids (see .create() below), disconnected
// from the global Competency.indicators[] ids that assessment indicatorMarks, Performance
// Bands, and the scoring engines actually key off. No client UI reads this model today —
// see the matching note on the client hooks in modules/curriculum/hooks/useCompetencies.js.
const CurriculumCompetencyIndicatorModel = {
  findByLink(curriculumId, competencyId) {
    return db(TABLE).where({ curriculumId, competencyId });
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  create(data) {
    return createRecord(db, TABLE, data);
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  deleteByLink(curriculumId, competencyId) {
    return db(TABLE).where({ curriculumId, competencyId }).del();
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },

  deleteByCompetencyId(competencyId) {
    return db(TABLE).where({ competencyId }).del();
  },
};

module.exports = CurriculumCompetencyIndicatorModel;
