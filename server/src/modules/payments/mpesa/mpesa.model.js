const db = require("../../../config/db");
const { createRecord, firstOrNull, updateRecord, stringifyJsonFields } = require("../../../shared/utils/model.utils");

const REQUESTS = "mpesa_stk_requests";
const TRANSACTIONS = "mpesa_transactions";
const OPERATIONS = "mpesa_operations";
const JSON_FIELDS = ["callbackPayload", "rawPayload", "allocations", "result"];

const MpesaModel = {
  createRequest(data) { return createRecord(db, REQUESTS, stringifyJsonFields(data, JSON_FIELDS)); },
  updateRequest(id, data) { return updateRecord(db, REQUESTS, id, stringifyJsonFields(data, JSON_FIELDS)); },
  findRequestById(id) { return firstOrNull(db(REQUESTS).where({ id })); },
  findRequestByCheckoutId(checkoutRequestId) { return checkoutRequestId ? firstOrNull(db(REQUESTS).where({ checkoutRequestId })) : null; },
  // A prompt for this invoice still waiting on the payer, sent since `since`.
  findRecentPendingRequest(invoiceId, since) {
    return firstOrNull(db(REQUESTS).where({ invoiceId, status: "pending" }).where("createdAt", ">=", since).orderBy("createdAt", "desc"));
  },
  async countRequestsBy(initiatedBy, since) {
    const row = await db(REQUESTS).where({ initiatedBy }).where("createdAt", ">=", since).count({ count: "*" }).first();
    return Number(row?.count || 0);
  },
  // Prompts still pending — for the reconcile job.
  findPendingRequests({ olderThan, limit = 100 }) {
    return db(REQUESTS).where({ status: "pending" }).where("createdAt", "<=", olderThan).orderBy("createdAt", "asc").limit(limit);
  },
  // A prompt that was paid but whose M-Pesa receipt we never saw (settled by a status check) —
  // for matching to the Paybill notification of the same payment, on the same Paybill.
  findPaidRequestWithoutReceipt({ accountId, accountReference, amount, since }) {
    let query = db(REQUESTS).where({ accountReference, amount, status: "successful" }).whereNull("mpesaReceiptNumber").where("createdAt", ">=", since);
    query = accountId ? query.where({ accountId }) : query.whereNull("accountId");
    return firstOrNull(query.orderBy("createdAt", "desc"));
  },
  listRequests({ ownerAdminId, statuses, limit = 200 }) {
    let query = db(REQUESTS).where({ ownerAdminId }).orderBy("createdAt", "desc").limit(limit);
    if (statuses?.length) query = query.whereIn("status", statuses);
    return query;
  },

  createTransaction(data) { return createRecord(db, TRANSACTIONS, stringifyJsonFields(data, JSON_FIELDS)); },
  updateTransaction(id, data, connection = db) { return updateRecord(connection, TRANSACTIONS, id, stringifyJsonFields(data, JSON_FIELDS)); },
  findTransactionById(id, connection = db, forUpdate = false) {
    let query = connection(TRANSACTIONS).where({ id });
    if (forUpdate) query = query.forUpdate();
    return firstOrNull(query);
  },
  findTransactionByTransId(transId) { return transId ? firstOrNull(db(TRANSACTIONS).where({ transId })) : null; },
  findTransactionByStkRequestId(stkRequestId) { return firstOrNull(db(TRANSACTIONS).where({ stkRequestId })); },
  listTransactions({ ownerAdminId, status, from, to, limit = 500 }) {
    let query = db(TRANSACTIONS).where({ ownerAdminId }).orderBy("createdAt", "desc").limit(limit);
    if (status) query = query.where({ status });
    if (from) query = query.where("createdAt", ">=", from);
    if (to) query = query.where("createdAt", "<=", to);
    return query;
  },
  async countByStatus(ownerAdminId) {
    const rows = await db(TRANSACTIONS).where({ ownerAdminId }).select("status").count({ count: "*" }).groupBy("status");
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  },

  // Calls answered later at a result URL: payouts, status checks, reversals.
  createOperation(data) { return createRecord(db, OPERATIONS, stringifyJsonFields(data, JSON_FIELDS)); },
  updateOperation(id, data) { return updateRecord(db, OPERATIONS, id, stringifyJsonFields(data, JSON_FIELDS)); },
  findOperationById(id) { return firstOrNull(db(OPERATIONS).where({ id })); },
  // Safaricom answers with both ids; ours (OriginatorConversationID) is the one we chose.
  findOperationForResult({ originatorConversationId, conversationId }) {
    if (!originatorConversationId && !conversationId) return null;
    return firstOrNull(db(OPERATIONS).where((q) => {
      if (originatorConversationId) q.orWhere({ originatorConversationId });
      if (conversationId) q.orWhere({ conversationId });
    }).orderBy("createdAt", "desc"));
  },
  findOperationsForTransactions(transactionIds) {
    return transactionIds.length ? db(OPERATIONS).whereIn("transactionId", transactionIds).orderBy("createdAt", "desc") : [];
  },
  findOperationsForClaim(claimId) {
    return db(OPERATIONS).where({ claimId, kind: "payout" }).orderBy("createdAt", "desc");
  },
  findPendingOperations({ olderThan, limit = 100 }) {
    return db(OPERATIONS).where({ status: "pending" }).where("createdAt", "<=", olderThan).orderBy("createdAt", "asc").limit(limit);
  },

  transaction(callback) { return db.transaction(callback); },
};

module.exports = MpesaModel;
