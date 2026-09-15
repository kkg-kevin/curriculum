const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "hub_visits";

const HubVisitModel = {
  create(data, connection = db) {
    return createRecord(connection, TABLE, data);
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // Duplicate-guard lookup - one row per learner+space+day. excludeId lets updateVisit re-check
  // a changed visitDate without the row being updated colliding with itself.
  findExisting(learnerId, spaceId, visitDate, excludeId) {
    let query = db(TABLE).where({ learnerId, spaceId, visitDate });
    if (excludeId) query = query.whereNot({ id: excludeId });
    return firstOrNull(query);
  },

  findAll({ hubId, learnerId, spaceId, billingStatus, from, to } = {}) {
    let query = db(TABLE);
    if (hubId) query = query.where({ hubId });
    if (learnerId) query = query.where({ learnerId });
    if (spaceId) query = query.where({ spaceId });
    if (billingStatus) query = query.where({ billingStatus });
    if (from && to) query = query.whereBetween("visitDate", [from, to]);
    else if (from) query = query.where("visitDate", ">=", from);
    else if (to) query = query.where("visitDate", "<=", to);
    return query.orderBy("visitDate", "desc");
  },

  findUnbilled({ hubId, from, to }) {
    return HubVisitModel.findAll({ hubId, billingStatus: "unbilled", from, to });
  },

  update(id, data, connection = db) {
    return updateRecord(connection, TABLE, id, data);
  },

  // Bulk-flips a batch of visits to "invoiced" once generateCharges has created their invoice
  // item - called inside the transaction that created those items, so a failure partway through
  // rolls both back together.
  async markInvoiced(invoiceItemIdByVisitId, trx) {
    for (const [visitId, invoiceItemId] of Object.entries(invoiceItemIdByVisitId)) {
      await updateRecord(trx, TABLE, visitId, { billingStatus: "invoiced", invoiceItemId });
    }
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = HubVisitModel;
