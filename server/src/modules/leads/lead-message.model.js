const db = require("../../config/db");
const { createRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "lead_messages";

const LeadMessageModel = {
  create(data) {
    return createRecord(db, TABLE, data, { updatedAt: false });
  },

  // A lead's full timeline (replies + notes), oldest first — the Enquiries card's thread view.
  findByLead(leadId) {
    return db(TABLE).where({ leadId }).orderBy("createdAt", "asc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },
};

module.exports = LeadMessageModel;
