const db = require("../../config/db");
const { createRecord, stringifyJsonFields, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "public_bootcamp_diagnostic_attempts";
const JSON_FIELDS = ["answers", "indicatorBreakdown", "itemsSnapshot", "itemResults"];

// One row per anonymous website visitor's completed public BOOTCAMP diagnostic — parallel to
// public-diagnostic-attempt.model.js (pathways), same write-once shape and reasoning (see that
// model's own comment, and the migration's).
const PublicBootcampDiagnosticAttemptModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS), { updatedAt: false });
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },
};

module.exports = PublicBootcampDiagnosticAttemptModel;
