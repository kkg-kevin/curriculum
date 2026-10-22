const crypto = require("crypto");
const db = require("../../../config/db");
const MpesaModel = require("./mpesa.model");
const MpesaClient = require("./mpesa.client");
const MpesaAccounts = require("./mpesa.accounts");
const { canQueryTransactions, canPayOut } = require("./mpesa.config");
const { normalisePhone, maskPhone, resultParameters } = require("./mpesa.utils");
const { _internal: { ownTransaction, transactionView } } = require("./mpesa.service");
const { createRecord } = require("../../../shared/utils/model.utils");

// M-Pesa calls whose outcome Safaricom sends later, to a result URL (mpesa-callback.routes.js):
//
//   payout    paying an approved educator claim from the B2C shortcode. The claim becomes paid
//             only when Safaricom's result says the money went (its M-Pesa receipt is the
//             claim's payment reference). One payout per claim at a time; one whose outcome never
//             came back blocks another until the admin confirms they've checked.
//   status    asking Safaricom about a transaction on the Paybill (Billing → M-Pesa → Check).
//   reversal  sending a payment that's on no invoice back to the payer (Billing → M-Pesa →
//             Reverse). Only for money that was never put on an invoice.
//
// Each is one mpesa_operations row: pending until its result arrives, then successful / failed,
// or timeout when Safaricom never answered (the reconcile job gives up after a day).

const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;
const money = (value) => Number(Number(value || 0).toFixed(2));
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };

const ClaimService = () => require("../../claims/claim.service");
const ClaimNotifications = () => require("../../claims/claim.notifications");

function view(op) {
  return {
    id: op.id,
    kind: op.kind,
    status: op.status,
    resultDesc: op.resultDesc,
    receiptNumber: op.receiptNumber,
    receiverName: op.receiverName,
    amount: op.amount == null ? null : money(op.amount),
    phone: maskPhone(op.phone),
    result: op.result || null,
    createdAt: op.createdAt,
    updatedAt: op.updatedAt,
  };
}

// Sends an operation's request, its row already saved (so a fast result always finds it).
async function send(op, call) {
  try {
    const sent = await call();
    return MpesaModel.updateOperation(op.id, { conversationId: sent.conversationId, ...(op.originatorConversationId ? {} : { originatorConversationId: sent.originatorConversationId }) });
  } catch (err) {
    await MpesaModel.updateOperation(op.id, { status: "error", resultDesc: String(err.message).slice(0, 255) });
    console.error(`[mpesa] ${op.kind} request failed:`, err.message, err.body ? JSON.stringify(err.body) : "");
    fail(`M-Pesa didn't take the request: ${err.message}`, 409);
  }
}

async function start(fields, call) {
  return send(await MpesaModel.createOperation({ status: "pending", ...fields }), call);
}

// ---- Results ----

async function finishPayout(op, { ok, receipt, receiverName, resultDesc }) {
  const claim = await ClaimService().getOwned(op.claimId, op.ownerAdminId).catch(() => null);
  if (!claim) return;
  if (!ok) {
    await ClaimNotifications().payoutFailed?.(claim, resultDesc);
    return;
  }
  try {
    const updated = await ClaimService().markPaid(claim.id, op.ownerAdminId, { paymentReference: `M-Pesa ${receipt || ""}`.trim(), paidAt: new Date() }, { id: op.requestedBy, name: "M-Pesa" });
    await ClaimNotifications().payoutSent?.(updated, { receipt, receiverName });
  } catch (err) {
    // Marked paid by hand while the payout was on its way — the money still went; say so.
    console.warn(`[mpesa] payout ${op.id} succeeded but claim ${claim.id} couldn't be marked paid:`, err.message);
    await ClaimNotifications().payoutSent?.(claim, { receipt, receiverName, note: "The claim had already been marked as paid." });
  }
}

async function finishReversal(op, { ok, resultDesc, receipt }) {
  if (!op.transactionId) return;
  const tx = await MpesaModel.findTransactionById(op.transactionId);
  if (!tx) return;
  if (ok) {
    await MpesaModel.updateTransaction(tx.id, { status: "reversed", unallocatedAmount: 0, note: `Sent back to the payer${receipt ? ` (M-Pesa ${receipt})` : ""}` });
  } else {
    await MpesaModel.updateTransaction(tx.id, { note: `Reversal failed: ${resultDesc || "no reason given"}`.slice(0, 255) });
  }
}

const MpesaOperations = {
  view,

  // ---- Educator claims: pay by M-Pesa ----

  // Whether payouts are possible, and the claim's payouts so far — for the claim dialog.
  async payoutsForClaim(claimId, req) {
    const claim = await ClaimService().getOwned(claimId, req.ownerAdminId);
    const account = await MpesaAccounts.forOwner(req.ownerAdminId);
    const payouts = (await MpesaModel.findOperationsForClaim(claim.id)).map(view);
    return { canPayOut: canPayOut(account) && (claim.currency || "KES") === "KES", phone: claim.teacherPhone || null, payouts };
  },

  // `amount` is what the admin saw and confirmed — it must still be the claim's amount.
  // `confirmUnknown` is needed when an earlier payout's outcome never came back.
  async payClaim(claimId, { phone, amount, confirmUnknown = false }, req) {
    const claim = await ClaimService().getOwned(claimId, req.ownerAdminId);
    if (claim.status !== "approved") fail("Only an approved claim can be paid", 409);
    if ((claim.currency || "KES") !== "KES") fail("Only claims in Kenya shillings can be paid by M-Pesa");
    const account = await MpesaAccounts.forOwner(req.ownerAdminId);
    if (!canPayOut(account)) fail("Paying by M-Pesa isn't set up for this workspace", 409);
    const value = money(claim.amount);
    if (!Number.isInteger(value)) fail(`M-Pesa pays whole shillings and this claim is KES ${value} — pay it another way and mark it as paid`);
    if (Number(amount) !== value) fail("The claim's amount has changed — check it and confirm again", 409);
    const msisdn = normalisePhone(phone || claim.teacherPhone);
    if (!msisdn) fail("Enter the educator's Safaricom number, e.g. 0712 345 678");

    // The checks and the new row happen under a lock on the claim, so two admins pressing Pay at
    // the same moment can't both send money.
    const originatorConversationId = `df-${crypto.randomUUID()}`;
    const op = await db.transaction(async (trx) => {
      await trx("teacher_claims").where({ id: claim.id }).forUpdate().first();
      const earlier = await trx("mpesa_operations").where({ claimId: claim.id, kind: "payout" }).orderBy("createdAt", "desc");
      if (earlier.some((o) => o.status === "successful")) fail("This claim has already been paid by M-Pesa", 409);
      if (earlier.some((o) => o.status === "pending")) fail("A payment for this claim is already on its way — wait for M-Pesa's answer", 409);
      if (earlier[0]?.status === "timeout" && !confirmUnknown) {
        fail("M-Pesa never said whether the last payment went through. Check the B2C account's statement first, then confirm to pay again.", 409);
      }
      return createRecord(trx, "mpesa_operations", {
        kind: "payout", status: "pending", ownerAdminId: req.ownerAdminId, accountId: MpesaAccounts.idOf(account), claimId: claim.id,
        phone: msisdn, amount: value, originatorConversationId, requestedBy: req.user.id,
      });
    });
    const sent = await send(op, () => MpesaClient.b2cPayment(account, {
      phone: msisdn, amount: value, originatorConversationId,
      remarks: `Claim ${claim.courseName || ""}`.trim(), occasion: claim.type === "advance" ? "Advance" : "Claim",
    }));
    return view(sent);
  },

  // ---- Billing → M-Pesa: check and reverse ----

  async checkTransaction(transactionId, req) {
    const tx = await ownTransaction(transactionId, req);
    if (!tx.transId) fail("This payment has no M-Pesa receipt to check yet");
    const account = await MpesaAccounts.byId(tx.accountId);
    if (!canQueryTransactions(account)) fail("Checking transactions needs the Paybill's API operator — add it in Settings → Payments (or MPESA_INITIATOR_NAME on the server)", 409);
    const op = await start({ kind: "status", ownerAdminId: tx.ownerAdminId, accountId: tx.accountId || null, transactionId: tx.id, transId: tx.transId, amount: tx.amount, requestedBy: req.user.id },
      () => MpesaClient.transactionStatus(account, { transId: tx.transId }));
    return view(op);
  },

  async reverseTransaction(transactionId, { note }, req) {
    const tx = await ownTransaction(transactionId, req);
    if (!["unallocated", "ignored"].includes(tx.status) || money(tx.unallocatedAmount) !== money(tx.amount) || tx.paymentId) {
      fail("Only a payment that was never put on an invoice can be sent back", 409);
    }
    if (!tx.transId) fail("This payment has no M-Pesa receipt yet, so it can't be reversed");
    const account = await MpesaAccounts.byId(tx.accountId);
    if (!canQueryTransactions(account)) fail("Reversing payments needs the Paybill's API operator — add it in Settings → Payments (or MPESA_INITIATOR_NAME on the server)", 409);
    const pending = await db("mpesa_operations").where({ transactionId: tx.id, kind: "reversal" }).whereIn("status", ["pending", "successful"]).first();
    if (pending) fail(pending.status === "pending" ? "A reversal of this payment is already on its way" : "This payment has already been reversed", 409);
    const op = await start({ kind: "reversal", ownerAdminId: tx.ownerAdminId, accountId: tx.accountId || null, transactionId: tx.id, transId: tx.transId, amount: tx.amount, requestedBy: req.user.id },
      () => MpesaClient.reversal(account, { transId: tx.transId, amount: Math.round(Number(tx.amount)), remarks: note || "Refund" }));
    await MpesaModel.updateTransaction(tx.id, { note: `Reversal requested${note ? `: ${note}` : ""}`.slice(0, 255) });
    return transactionView(await MpesaModel.findTransactionById(tx.id), [op]);
  },

  // ---- Safaricom's answers (mpesa-callback.routes.js). Never throw. ----

  async handleResult(kind, body, account) {
    const result = body?.Result;
    if (!result) return;
    const op = await MpesaModel.findOperationForResult({ originatorConversationId: result.OriginatorConversationID, conversationId: result.ConversationID });
    if (!op || op.kind !== kind || !MpesaAccounts.sameAccount(op.accountId, MpesaAccounts.idOf(account))) {
      console.warn(`[mpesa] ${kind} result for a request we didn't make:`, result.OriginatorConversationID, result.ConversationID);
      return;
    }
    if (op.status !== "pending" && op.status !== "timeout") return; // a repeat
    const ok = String(result.ResultCode) === "0";
    const params = resultParameters(result);
    const receipt = String(params.TransactionReceipt || params.ReceiptNo || result.TransactionID || "").slice(0, 40) || null;
    const receiverName = params.ReceiverPartyPublicName ? String(params.ReceiverPartyPublicName).slice(0, 150) : null;
    const resultDesc = String(result.ResultDesc || "").slice(0, 255);
    // Only the first answer counts: a pending row is claimed by this update or not at all.
    const claimed = await db("mpesa_operations").where({ id: op.id }).whereIn("status", ["pending", "timeout"]).update({
      status: ok ? "successful" : "failed", resultCode: String(result.ResultCode), resultDesc,
      receiptNumber: receipt, receiverName, result: JSON.stringify({ ...params, raw: body }), updatedAt: new Date(),
    });
    if (!claimed) return;
    if (kind === "payout") await finishPayout(op, { ok, receipt, receiverName, resultDesc });
    if (kind === "reversal") await finishReversal(op, { ok, receipt, resultDesc });
  },

  // Safaricom's queue gave up on the request. For a payout that means the money may or may not
  // have gone — the claim stays approved and the admin is asked to check.
  async handleTimeout(kind, body, account) {
    const result = body?.Result || body;
    const op = await MpesaModel.findOperationForResult({ originatorConversationId: result?.OriginatorConversationID, conversationId: result?.ConversationID });
    if (!op || op.kind !== kind || !MpesaAccounts.sameAccount(op.accountId, MpesaAccounts.idOf(account))) return;
    await markTimedOut(op);
  },

  // The reconcile job: operations still waiting a day later are marked timed out.
  async expireStale() {
    const stale = await MpesaModel.findPendingOperations({ olderThan: new Date(Date.now() - GIVE_UP_AFTER_MS), limit: 200 });
    for (const op of stale) await markTimedOut(op);
    return stale.length;
  },
};

async function markTimedOut(op) {
  const changed = await db("mpesa_operations").where({ id: op.id, status: "pending" }).update({ status: "timeout", resultDesc: "M-Pesa never answered", updatedAt: new Date() });
  if (!changed || op.kind !== "payout") return;
  const claim = await ClaimService().getOwned(op.claimId, op.ownerAdminId).catch(() => null);
  if (claim) await ClaimNotifications().payoutFailed?.(claim, "M-Pesa didn't say whether the payment went through — check the B2C statement before paying again");
}

module.exports = MpesaOperations;
