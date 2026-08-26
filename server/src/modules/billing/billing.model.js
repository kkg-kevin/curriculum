const db = require("../../config/db");
const { createRecord, firstOrNull, updateRecord, generateId, stringifyJsonFields } = require("../../shared/utils/model.utils");

const INVOICES = "billing_invoices";
const ITEMS = "billing_invoice_items";
const PAYMENTS = "billing_payments";
const BATCHES = "billing_invoice_batches";
const AUDIT = "billing_audit_events";
const SEQUENCES = "billing_number_sequences";

const BillingModel = {
  createInvoice(data, connection = db) { return createRecord(connection, INVOICES, data); },
  // Atomic sequential counter for INV-YYYY-000001 / RCT-YYYY-000001 numbering. LAST_INSERT_ID(expr)
  // is a MySQL idiom for counters on non-AUTO_INCREMENT tables: it sets an arbitrary computed value
  // as the statement's own insertId, safely under concurrent callers because the whole
  // INSERT ... ON DUPLICATE KEY UPDATE runs as one atomic statement (a SELECT...FOR UPDATE here
  // would instead take a gap lock on a not-yet-existing row, and two such locks are mutually
  // compatible — a real deadlock risk on the very first invoice of a year).
  async nextNumber(scope, year, connection = db) {
    // LAST_INSERT_ID(expr) must appear on BOTH branches — a plain INSERT with no AUTO_INCREMENT
    // column reports insertId 0 by default, so wrapping only the ON DUPLICATE KEY UPDATE branch
    // (as MySQL's own docs example does, for tables that also have a real AUTO_INCREMENT id)
    // silently returns 0 for the first-ever call on a fresh (scope, year) row.
    const [result] = await connection.raw(
      `INSERT INTO ${SEQUENCES} (id, scope, year, lastNumber, createdAt, updatedAt)
       VALUES (?, ?, ?, LAST_INSERT_ID(1), NOW(), NOW())
       ON DUPLICATE KEY UPDATE lastNumber = LAST_INSERT_ID(lastNumber + 1), updatedAt = NOW()`,
      [generateId(), scope, year]
    );
    return result.insertId;
  },
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
  findPaymentById(id) { return firstOrNull(db(PAYMENTS).where({ id })); },
  findPaymentsByInvoiceIds(invoiceIds) { return invoiceIds.length ? db(PAYMENTS).whereIn("invoiceId", invoiceIds).orderBy("paidAt", "desc") : []; },
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
