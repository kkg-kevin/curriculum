const db = require("../../config/db");
const { createRecord } = require("../../shared/utils/model.utils");

const TABLE = "learner_transfers";

// Write-once audit log — see the migration's comment for why this exists as its own table
// instead of a status value on learner_hub_links.
const LearnerTransferModel = {
  create(data) {
    return createRecord(db, TABLE, data, { updatedAt: false });
  },

  findByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId }).orderBy("createdAt", "desc");
  },
};

module.exports = LearnerTransferModel;
