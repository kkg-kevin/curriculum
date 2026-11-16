const db = require("../../config/db");
const { createRecord } = require("../../shared/utils/model.utils");

const TABLE = "learner_transfers";

// Write-once record of a learner's moves: hub → hub (the hub card's Transfer, a hub's removal) and
// between programmes (modules/learner-moves/, which also reads them back as the learner's Moves).
// Each row says which programme and record each side was, with labels kept as they read then.
const LearnerTransferModel = {
  create(data) {
    return createRecord(db, TABLE, data, { updatedAt: false });
  },

  findByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId }).orderBy("createdAt", "desc");
  },
};

module.exports = LearnerTransferModel;
