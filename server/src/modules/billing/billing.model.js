const db = require("../../config/db");
const { createRecord, firstOrNull, updateRecord, generateId, stringifyJsonFields } = require("../../shared/utils/model.utils");

const INVOICES = "billing_invoices";
const ITEMS = "billing_invoice_items";
const PAYMENTS = "billing_payments";

const BillingModel = {
  createInvoice(data) { return createRecord(db, INVOICES, data); },
  createItem(data) { return createRecord(db, ITEMS, stringifyJsonFields(data, ["metadata"]), { updatedAt: false }); },
  createPayment(data) { return createRecord(db, PAYMENTS, stringifyJsonFields(data, ["metadata"])); },
  findInvoiceById(id) { return firstOrNull(db(INVOICES).where({ id })); },
  findInvoices(filters = {}) {
    let query = db(INVOICES).select("billing_invoices.*").orderBy("createdAt", "desc");
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") query = query.where(key, value);
    }
    return query;
  },
  findItems(invoiceId) { return db(ITEMS).where({ invoiceId }).orderBy("createdAt", "asc"); },
  findPayments(invoiceId) { return db(PAYMENTS).where({ invoiceId }).orderBy("createdAt", "asc"); },
  updateInvoice(id, data) { return updateRecord(db, INVOICES, id, data); },
  sumSuccessfulPayments(invoiceId) {
    return db(PAYMENTS).where({ invoiceId, status: "successful" }).sum({ total: "amount" }).first();
  },
  transaction() { return db.transaction(); },
  generateId,
};

module.exports = BillingModel;
