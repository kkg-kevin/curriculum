const db = require("../../config/db");
const { createRecord, firstOrNull, updateRecord, generateId, stringifyJsonFields } = require("../../shared/utils/model.utils");

const INVOICES = "billing_invoices";
const ITEMS = "billing_invoice_items";
const PAYMENTS = "billing_payments";
const BATCHES = "billing_invoice_batches";
const AUDIT = "billing_audit_events";

const BillingModel = {
  createInvoice(data, connection = db) { return createRecord(connection, INVOICES, data); },
  createBatch(data, connection = db) { return createRecord(connection, BATCHES, data); },
  createItem(data, connection = db) { return createRecord(connection, ITEMS, stringifyJsonFields(data, ["metadata"]), { updatedAt: false }); },
  createPayment(data, connection = db) { return createRecord(connection, PAYMENTS, stringifyJsonFields(data, ["metadata"])); },
  findPaymentByIdempotencyKey(idempotencyKey, connection = db) { return idempotencyKey ? firstOrNull(connection(PAYMENTS).where({ idempotencyKey })) : null; },
  createAuditEvent(data, connection = db) { return createRecord(connection, AUDIT, stringifyJsonFields(data, ["metadata"]), { updatedAt: false }); },
  findInvoiceById(id, connection = db, forUpdate = false) {
    let query = connection(INVOICES).where({ id });
    if (forUpdate) query = query.forUpdate();
    return firstOrNull(query);
  },
  findBatchById(id) { return firstOrNull(db(BATCHES).where({ id })); },
  findBatches(filters = {}) {
    let query = db(BATCHES).orderBy("createdAt", "desc");
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") query = query.where(key, value);
    }
    return query;
  },
  findInvoicesByBatchId(batchId) { return db(INVOICES).where({ batchId }).orderBy("createdAt", "asc"); },
  findExistingLearnerInvoice({ hubId, learnerId, invoiceType, periodLabel }) {
    return firstOrNull(db(INVOICES).where({ hubId, learnerId, invoiceType, periodLabel: periodLabel || null }).whereNotIn("status", ["cancelled", "void"]));
  },
  findInvoices(filters = {}) {
    let query = db(INVOICES).select("billing_invoices.*").orderBy("createdAt", "desc");
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") query = query.where(key, value);
    }
    return query;
  },
  findItems(invoiceId) { return db(ITEMS).where({ invoiceId }).orderBy("createdAt", "asc"); },
  findPayments(invoiceId) { return db(PAYMENTS).where({ invoiceId }).orderBy("createdAt", "asc"); },
  findAuditEvents(invoiceId) { return db(AUDIT).where({ invoiceId }).orderBy("createdAt", "asc"); },
  updateInvoice(id, data, connection = db) { return updateRecord(connection, INVOICES, id, data); },
  updateBatch(id, data, connection = db) { return updateRecord(connection, BATCHES, id, data); },
  sumSuccessfulPayments(invoiceId, connection = db) {
    return connection(PAYMENTS).where({ invoiceId, status: "successful" }).sum({ total: "amount" }).first();
  },
  transaction(callback) { return db.transaction(callback); },
  generateId,
};

module.exports = BillingModel;
