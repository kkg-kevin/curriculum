const db = require("../../config/db");
const { createRecord, stringifyJsonFields, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "public_diagnostic_attempts";
const JSON_FIELDS = ["answers", "indicatorBreakdown", "itemsSnapshot", "itemResults"];

// One row per anonymous website visitor's completed public diagnostic. Write-once — an attempt
// is graded and stored in a single step (see public-diagnostic.service.js), it never transitions
// status the way assessment_submissions does, so there's no update()/status lifecycle here.
const PublicDiagnosticAttemptModel = {
  // updatedAt: false — this table has no updatedAt column (see the migration's comment: an
  // attempt is graded and written once, it never transitions state the way
  // assessment_submissions does), so createRecord must not try to stamp one.
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS), { updatedAt: false });
  },

  // Fetch by opaque uuid — the permanent shareable-report link's only lookup. mysql2 auto-parses
  // JSON columns back to JS on read (see CLAUDE.md), so answers/indicatorBreakdown/itemsSnapshot
  // come back already deserialized.
  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },
};

module.exports = PublicDiagnosticAttemptModel;
