const db = require("../../../config/db");
const MpesaModel = require("./mpesa.model");
const MpesaClient = require("./mpesa.client");
const MpesaAccounts = require("./mpesa.accounts");
const { settings, isConfigured, canQueryTransactions, canPayOut } = require("./mpesa.config");
const { accountForInvoice, invoiceOwnerId, paymentInstructions } = require("./mpesa.instructions");
const { parseStatement } = require("./mpesa.statement");
const {
  normalisePhone, maskPhone, parseDarajaTimestamp, paymentCodeFor, invoiceNumberFromAccount,
  callbackItem, describeStkResult, wholeShillings,
} = require("./mpesa.utils");
const BillingService = require("../../billing/billing.service");
const BillingModel = require("../../billing/billing.model");
const NotificationService = require("../../notifications/notification.service");
const PaymentLinks = require("../payment-links");
const PaymentOptions = require("../payment-options");
const { organisationIdOf } = require("../../../shared/utils/organisation");

// M-Pesa payments into a Paybill — the workspace's own (Settings → Payments) or the
// installation's (.env); see mpesa.accounts.js. Money arrives three ways:
//
//   1. A prompt ("STK Push"): someone presses Pay with M-Pesa (or staff press Request payment, or
//      a family presses Pay now at the end of a website sign-up), the payer's phone asks for their
//      PIN, and Safaricom calls handleStkCallback with the result. A "paid" result is confirmed
//      with Safaricom before it's credited (MPESA_VERIFY_CALLBACKS). A prompt that never calls
//      back is checked by the reconcile job (npm run mpesa:reconcile) and whenever the payer's
//      screen asks how it's going.
//   2. Paid straight to the Paybill with the invoice's payment code as the account number:
//      Safaricom calls handleC2bConfirmation. A code that matches a payable invoice on the same
//      Paybill is paid onto it; anything else waits in Billing → M-Pesa for staff to match.
//   3. A statement imported in Billing → M-Pesa — for anything the callbacks missed. Handled the
//      same way as 2.
//
// Every shilling that arrives gets one mpesa_transactions row (its M-Pesa receipt is UNIQUE), and
// is put on an invoice through BillingService.applyPayment — so a callback repeated, or a
// callback and a status check arriving together, can never pay an invoice twice.

const PAYABLE = ["issued", "partially_paid", "overdue"];
const RESEND_WAIT_MS = 90 * 1000; // one prompt per invoice at a time
const USER_LIMIT = { count: 5, windowMs: 10 * 60 * 1000 }; // prompts one person can start
const LINK_LIMIT = { count: 8, windowMs: 60 * 60 * 1000 }; // prompts one payment link can start
const QUERY_AFTER_MS = 45 * 1000; // ask Safaricom about a prompt that hasn't called back
const QUERY_GAP_MS = 20 * 1000;
const GIVE_UP_AFTER_MS = 15 * 60 * 1000; // a prompt still unanswered after this has timed out
const MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const STATEMENT_MAX_ROWS = 5000;

const money = (value) => Number(Number(value || 0).toFixed(2));
const fail = (message, statusCode = 400, extra = {}) => { throw Object.assign(new Error(message), { statusCode, ...extra }); };

// Whose workspace Paybill money that matches no invoice lands in: the account's own workspace,
// or for the installation's Paybill, MPESA_OWNER_ADMIN_ID (see mpesa.config.js).
const defaultOwners = new Map();
function defaultOwner(account = MpesaAccounts.installation()) {
  if (account?.id && account.id !== "env") return Promise.resolve(account.ownerAdminId);
  const configured = MpesaAccounts.installation().defaultOwnerAdminId;
  if (!configured) return Promise.resolve(null);
  if (!defaultOwners.has(configured)) {
    defaultOwners.set(configured, db("users").where({ id: configured }).first()
      .then((user) => (user ? organisationIdOf(user) : configured))
      .catch(() => { defaultOwners.delete(configured); return configured; }));
  }
  return defaultOwners.get(configured);
}

// What the payer's screen polls: where the prompt is, in words.
function requestView(request) {
  const message = request.status === "pending"
    ? "Check your phone and enter your M-Pesa PIN."
    : request.status === "error"
      ? (request.resultDesc || "M-Pesa couldn't send the prompt.")
      : describeStkResult(request.resultCode ?? (request.status === "timeout" ? 1037 : 0)).message;
  return {
    id: request.id,
    invoiceId: request.invoiceId,
    status: request.status,
    message,
    amount: Number(request.amount),
    phone: maskPhone(request.phone),
    receiptNumber: request.mpesaReceiptNumber || null,
    createdAt: request.createdAt,
  };
}

function operationView(op) {
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

function transactionView(tx, operations = []) {
  return {
    id: tx.id,
    source: tx.source,
    transId: tx.transId,
    transTime: tx.transTime,
    amount: money(tx.amount),
    unallocatedAmount: money(tx.unallocatedAmount),
    phone: maskPhone(tx.msisdn),
    payerName: tx.payerName,
    billRefNumber: tx.billRefNumber,
    status: tx.status,
    invoiceId: tx.invoiceId,
    allocations: tx.allocations || [],
    note: tx.note,
    allocatedAt: tx.allocatedAt,
    createdAt: tx.createdAt,
    operations: operations.map(operationView),
  };
}

// The amount a prompt asks for: what's due, in whole shillings, unless the payer chose to pay
// part of it.
function promptAmount(invoice, requested, maxAmount) {
  const due = money(Number(invoice.total) - Number(invoice.amountPaid || 0));
  const max = wholeShillings(due);
  if (max < 1) fail("This invoice has nothing left to pay");
  const amount = requested === undefined || requested === null || requested === "" ? max : Number(requested);
  if (!Number.isInteger(amount)) fail("M-Pesa takes whole shillings — enter an amount without cents");
  if (amount < 1) fail("Enter an amount of at least KES 1");
  if (amount > max) fail(`That's more than the KES ${max.toLocaleString("en-KE")} due on this invoice`);
  if (amount > maxAmount) fail(`M-Pesa takes at most KES ${maxAmount.toLocaleString("en-KE")} in one payment — pay part now and the rest separately`);
  return amount;
}

// Sends the prompt for an invoice the caller has already been allowed to pay.
async function startPrompt(invoice, { phone, amount, initiatedBy = null, linkId = null }) {
  const account = await accountForInvoice(invoice);
  if (!isConfigured(account)) fail("M-Pesa payments aren't set up for this invoice", 409);
  if (!PAYABLE.includes(invoice.status)) fail(invoice.status === "paid" ? "This invoice is already paid" : "This invoice is not payable");
  if ((invoice.currency || "KES") !== "KES") fail("Only invoices in Kenya shillings can be paid by M-Pesa");
  const accountReference = paymentCodeFor(invoice.invoiceNumber);
  if (!accountReference) fail("This invoice can't be paid by M-Pesa yet");
  const msisdn = normalisePhone(phone);
  if (!msisdn) fail("Enter a Safaricom number, e.g. 0712 345 678");
  const value = promptAmount(invoice, amount, account.maxAmount);

  const recent = await MpesaModel.findRecentPendingRequest(invoice.id, new Date(Date.now() - RESEND_WAIT_MS));
  if (recent) fail("A payment prompt was just sent for this invoice. Check the phone, or wait a minute and try again.", 409, { requestId: recent.id });
  if (initiatedBy && (await MpesaModel.countRequestsBy(initiatedBy, new Date(Date.now() - USER_LIMIT.windowMs))) >= USER_LIMIT.count) {
    fail("Too many payment prompts in a short time. Wait a few minutes and try again.", 429);
  }
  if (linkId) {
    const sent = await db("mpesa_stk_requests").where({ invoiceId: invoice.id }).whereNull("initiatedBy").where("createdAt", ">=", new Date(Date.now() - LINK_LIMIT.windowMs)).count({ count: "*" }).first();
    if (Number(sent?.count || 0) >= LINK_LIMIT.count) fail("Too many payment prompts for this invoice. Wait a while and try again, or pay to the Paybill.", 429);
  }

  const request = await MpesaModel.createRequest({
    ownerAdminId: await invoiceOwnerId(invoice), accountId: MpesaAccounts.idOf(account), invoiceId: invoice.id, initiatedBy,
    phone: msisdn, amount: value, accountReference, status: "pending",
  });
  try {
    const sent = await MpesaClient.stkPush(account, { phone: msisdn, amount: value, accountReference, description: "Invoice" });
    const updated = await MpesaModel.updateRequest(request.id, { merchantRequestId: sent.merchantRequestId, checkoutRequestId: sent.checkoutRequestId });
    return requestView(updated);
  } catch (err) {
    await MpesaModel.updateRequest(request.id, { status: "error", resultDesc: String(err.message).slice(0, 255) });
    console.error("[mpesa] payment prompt failed:", err.message, err.body ? JSON.stringify(err.body) : "");
    // 409 rather than a 5xx so the payer reads the reason (5xx messages are hidden in production).
    fail(`M-Pesa couldn't send the prompt: ${err.message}`, 409);
  }
}

// What a successful STK callback says about the money.
function callbackDetails(body) {
  const items = body?.Body?.stkCallback?.CallbackMetadata?.Item;
  const receipt = callbackItem(items, "MpesaReceiptNumber");
  const amount = callbackItem(items, "Amount");
  const phone = callbackItem(items, "PhoneNumber");
  return {
    receipt: receipt ? String(receipt) : null,
    amount: amount === undefined ? undefined : Number(amount),
    msisdn: phone ? String(phone) : null,
    transTime: parseDarajaTimestamp(callbackItem(items, "TransactionDate")),
  };
}

// Money for a prompt arrived (its callback said so, or a status check did). `receipt` is the
// M-Pesa receipt when we have it — a status check doesn't carry one.
async function settlePrompt(request, { receipt = null, amount, msisdn = null, transTime = null, raw = null }) {
  await MpesaModel.updateRequest(request.id, { status: "successful", ...(receipt ? { mpesaReceiptNumber: receipt } : {}) });

  // The same money may already be on file: an earlier callback, or Safaricom's Paybill
  // notification for this very payment (same receipt, or same code and amount when we have no
  // receipt to compare).
  const findExisting = async () => (await MpesaModel.findTransactionByStkRequestId(request.id))
    || (receipt ? await MpesaModel.findTransactionByTransId(receipt) : null)
    || (!receipt ? await sameAccountRows(db("mpesa_transactions").where({ source: "c2b", billRefNumber: request.accountReference, amount: request.amount }).whereNull("stkRequestId").where("createdAt", ">=", request.createdAt), request.accountId).first() : null);
  const link = async (tx) => {
    const patch = {};
    if (!tx.stkRequestId) patch.stkRequestId = request.id;
    if (!tx.transId && receipt) patch.transId = receipt;
    if (Object.keys(patch).length) await MpesaModel.updateTransaction(tx.id, patch).catch(() => {});
    if (patch.transId && tx.paymentId) await BillingModel.updatePaymentReference(tx.paymentId, receipt).catch(() => {});
    if (!receipt && tx.transId) await MpesaModel.updateRequest(request.id, { mpesaReceiptNumber: tx.transId });
    await MpesaModel.updateRequest(request.id, { transactionId: tx.id });
  };

  const existing = await findExisting();
  if (existing) return link(existing);

  const account = await MpesaAccounts.byId(request.accountId);
  let tx;
  try {
    tx = await MpesaModel.createTransaction({
      ownerAdminId: request.ownerAdminId, accountId: request.accountId || null, source: "stk", shortcode: account?.shortcode || null, transId: receipt, stkRequestId: request.id,
      transTime: transTime || new Date(), amount: money(amount ?? request.amount), msisdn: msisdn || request.phone, billRefNumber: request.accountReference,
      status: "unallocated", unallocatedAmount: money(amount ?? request.amount), rawPayload: raw,
    });
  } catch (err) {
    if (err.code !== "ER_DUP_ENTRY") throw err;
    const raced = await findExisting();
    if (raced) await link(raced);
    return;
  }
  await MpesaModel.updateRequest(request.id, { transactionId: tx.id });

  if (money(amount ?? request.amount) !== money(request.amount)) {
    await MpesaModel.updateTransaction(tx.id, { note: `Paid KES ${money(amount)} against a prompt for KES ${request.amount} — check before matching` });
    await notifyUnmatched(tx);
    return;
  }
  await allocate(tx, request.invoiceId, { actorUserId: null });
}

// Rows of `query` recorded against this account (null = the installation's Paybill).
function sameAccountRows(query, accountId) {
  return accountId ? query.where({ accountId }) : query.whereNull("accountId");
}

// Puts a transaction's unallocated money on an invoice. Whatever the invoice can't take (it's
// already paid, it's paid into a different Paybill, or the payment was more than due) stays on
// the transaction for staff.
async function allocate(tx, invoiceId, { actorUserId = null, quiet = false } = {}) {
  const invoice = await BillingModel.findInvoiceById(invoiceId);
  const amount = money(tx.unallocatedAmount);
  if (amount <= 0) return tx;
  const invoiceAccount = invoice ? await accountForInvoice(invoice) : null;
  const otherPaybill = invoice && !MpesaAccounts.sameAccount(MpesaAccounts.idOf(invoiceAccount), tx.accountId);
  if (!invoice || !PAYABLE.includes(invoice.status) || otherPaybill) {
    const note = !invoice ? "Invoice not found"
      : otherPaybill ? `Invoice ${invoice.invoiceNumber} is paid into a different Paybill`
        : `Invoice ${invoice.invoiceNumber} is ${invoice.status.replace(/_/g, " ")} — nothing to pay`;
    const updated = await MpesaModel.updateTransaction(tx.id, { note, ownerAdminId: tx.ownerAdminId || (otherPaybill ? null : await invoiceOwnerId(invoice)) || (await defaultOwner(await MpesaAccounts.byId(tx.accountId))) });
    if (!quiet) await notifyUnmatched(updated);
    return updated;
  }

  const allocations = Array.isArray(tx.allocations) ? tx.allocations : [];
  const n = allocations.length + 1;
  let result;
  try {
    result = await BillingService.applyPayment(invoice.id, {
      amount, provider: "mpesa", paymentMethod: "mpesa",
      providerReference: tx.transId ? (n === 1 ? tx.transId : `${tx.transId}/${n}`) : null,
      paymentDate: tx.transTime || new Date(), recordedBy: actorUserId, idempotencyKey: `mpesa:${tx.id}:${n}`,
      notes: tx.source === "stk" ? "M-Pesa (payment prompt)" : tx.source === "statement_import" ? "M-Pesa (from statement)" : "M-Pesa (Paybill)",
      metadata: { mpesaTransactionId: tx.id, source: tx.source, phone: maskPhone(tx.msisdn) },
      allowExcess: true,
    });
  } catch (err) {
    const updated = await MpesaModel.updateTransaction(tx.id, { note: String(err.message).slice(0, 255) });
    if (!quiet) await notifyUnmatched(updated);
    return updated;
  }
  if (result.duplicate) return MpesaModel.findTransactionById(tx.id);

  const credited = money(result.payment.amount);
  const remaining = money(amount - credited);
  const updated = await MpesaModel.updateTransaction(tx.id, {
    status: remaining > 0 ? "partially_allocated" : "allocated",
    invoiceId: tx.invoiceId || invoice.id,
    paymentId: tx.paymentId || result.payment.id,
    unallocatedAmount: remaining,
    allocations: [...allocations, { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, paymentId: result.payment.id, receiptNumber: result.payment.receiptNumber, amount: credited, at: new Date(), by: actorUserId }],
    allocatedBy: actorUserId, allocatedAt: new Date(),
    ownerAdminId: tx.ownerAdminId || (await invoiceOwnerId(invoice)),
    note: remaining > 0 ? `KES ${remaining} more than was due on ${invoice.invoiceNumber}` : null,
  });
  await BillingModel.createAuditEvent({ invoiceId: invoice.id, paymentId: result.payment.id, actorUserId, eventType: "mpesa_payment", amount: credited, metadata: { mpesaTransactionId: tx.id, transId: tx.transId, source: tx.source } }).catch(() => {});
  if (remaining > 0 && !quiet) await notifyUnmatched(updated);
  return updated;
}

// Staff are told when money is waiting to be matched by hand.
async function notifyUnmatched(tx) {
  const ownerAdminId = tx.ownerAdminId || (await defaultOwner(await MpesaAccounts.byId(tx.accountId)));
  if (!ownerAdminId) return;
  const left = money(tx.unallocatedAmount);
  await NotificationService._notify(ownerAdminId, {
    type: "mpesa_payment_unmatched",
    title: "M-Pesa payment to match",
    message: `KES ${left.toLocaleString("en-KE")} from ${tx.payerName || maskPhone(tx.msisdn) || "a payer"}${tx.billRefNumber ? ` (account "${tx.billRefNumber}")` : ""} couldn't be put on an invoice by itself. Match it in Billing → M-Pesa.`,
    payload: { route: "/billing?tab=mpesa" },
    dedupeKey: `mpesa_unmatched:${tx.id}:${left}`,
    ownerAdminId,
  }).catch(() => {});
}

// Money that arrived in a Paybill without a prompt of ours — a Paybill notification (C2B) or a
// statement row. Returns what became of it: "duplicate" (already on file), "linked" (it was a
// prompt's payment we'd settled without its receipt), or the new transaction's status.
async function recordIncoming(account, { source, transId, transTime, amount, msisdn, payerName, billRefNumber, shortcode, raw, ownerAdminId = null }) {
  if (await MpesaModel.findTransactionByTransId(transId)) return { outcome: "duplicate" };
  const accountId = MpesaAccounts.idOf(account);

  // The Paybill notification for a prompt we already settled without its receipt.
  if (billRefNumber) {
    const prompt = await MpesaModel.findPaidRequestWithoutReceipt({ accountId, accountReference: billRefNumber, amount: Math.round(amount), since: new Date(Date.now() - MATCH_WINDOW_MS) });
    const promptTx = prompt ? await MpesaModel.findTransactionByStkRequestId(prompt.id) : null;
    if (promptTx && !promptTx.transId) {
      await MpesaModel.updateTransaction(promptTx.id, { transId, rawPayload: { ...(promptTx.rawPayload || {}), [source]: raw } }).catch(() => {});
      await MpesaModel.updateRequest(prompt.id, { mpesaReceiptNumber: transId });
      if (promptTx.paymentId) await BillingModel.updatePaymentReference(promptTx.paymentId, transId).catch(() => {});
      return { outcome: "linked", transactionId: promptTx.id };
    }
  }

  const invoiceNumber = invoiceNumberFromAccount(billRefNumber);
  const invoice = invoiceNumber ? await db("billing_invoices").where({ invoiceNumber }).first() : null;
  const sameOwner = invoice && MpesaAccounts.sameAccount(MpesaAccounts.idOf(await accountForInvoice(invoice)), accountId) ? await invoiceOwnerId(invoice) : null;
  let tx;
  try {
    tx = await MpesaModel.createTransaction({
      // The invoice's own workspace when it matched one (the installation's Paybill is shared),
      // else whoever imported it, else the Paybill's default workspace.
      ownerAdminId: (accountId ? account.ownerAdminId : sameOwner) || ownerAdminId || (await defaultOwner(account)),
      accountId, source, shortcode: shortcode || account.shortcode,
      transId, transTime: transTime || new Date(), amount: money(amount), msisdn: msisdn ? String(msisdn).slice(0, 100) : null,
      payerName: payerName ? String(payerName).slice(0, 150) : null, billRefNumber, status: "unallocated", unallocatedAmount: money(amount), rawPayload: raw,
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return { outcome: "duplicate" };
    throw err;
  }
  if (!invoice) {
    const updated = await MpesaModel.updateTransaction(tx.id, { note: billRefNumber ? `No invoice matches account "${billRefNumber}"` : "No account number given" });
    if (source !== "statement_import") await notifyUnmatched(updated);
    return { outcome: "unallocated", transactionId: tx.id };
  }
  const after = await allocate(tx, invoice.id, { actorUserId: null, quiet: source === "statement_import" });
  return { outcome: after.status, transactionId: tx.id };
}

// Asks Safaricom about one pending prompt and records the answer. Returns the updated request.
async function checkPrompt(request) {
  if (request.status !== "pending" || !request.checkoutRequestId) return request;
  const account = await MpesaAccounts.byId(request.accountId);
  if (!isConfigured(account)) return request;
  const age = Date.now() - new Date(request.createdAt).getTime();
  try {
    const { resultCode, resultDesc, raw } = await MpesaClient.stkQuery(account, request.checkoutRequestId);
    if (resultCode === null) throw new MpesaClient.DarajaError("No result yet", { body: raw });
    const fresh = await MpesaModel.findRequestById(request.id);
    if (fresh.status !== "pending") return fresh;
    if (resultCode === "0") {
      await MpesaModel.updateRequest(request.id, { resultCode, resultDesc, lastQueriedAt: new Date() });
      // A callback that arrived but was waiting for this confirmation carries the receipt.
      const stored = String(fresh.callbackPayload?.Body?.stkCallback?.ResultCode) === "0" ? callbackDetails(fresh.callbackPayload) : {};
      await settlePrompt(fresh, { ...stored, amount: stored.amount ?? fresh.amount, raw: { query: raw, ...(fresh.callbackPayload ? { callback: fresh.callbackPayload } : {}) } });
    } else {
      await MpesaModel.updateRequest(request.id, { status: describeStkResult(resultCode).status, resultCode, resultDesc, lastQueriedAt: new Date() });
    }
  } catch (err) {
    const patch = { lastQueriedAt: new Date() };
    if (age > GIVE_UP_AFTER_MS) Object.assign(patch, { status: "timeout", resultDesc: err.pending ? "No answer from the phone" : String(err.message).slice(0, 255) });
    await MpesaModel.updateRequest(request.id, patch);
  }
  return MpesaModel.findRequestById(request.id);
}

// The payer's screen polling a prompt. A prompt that hasn't called back after a while is asked
// about directly.
async function pollRequest(request) {
  const age = Date.now() - new Date(request.createdAt).getTime();
  const lastAsked = request.lastQueriedAt ? Date.now() - new Date(request.lastQueriedAt).getTime() : Infinity;
  if (request.status === "pending" && age > QUERY_AFTER_MS && lastAsked > QUERY_GAP_MS) return requestView(await checkPrompt(request));
  return requestView(request);
}

function assertWorkspace(req) {
  if (req.user.role !== "admin" || !req.ownerAdminId) fail("Only the workspace's billing staff can see M-Pesa payments", 403);
}

async function ownTransaction(id, req) {
  assertWorkspace(req);
  const tx = await MpesaModel.findTransactionById(id);
  if (!tx || tx.ownerAdminId !== req.ownerAdminId) fail("M-Pesa payment not found", 404);
  return tx;
}

// A payment link's part-payment view: the plans a family may still choose (before anything is
// paid), the one chosen, the schedule with each part's state, and the next part to pay.
async function linkPlanView(invoice) {
  const doc = await BillingService.getInvoiceDocument(invoice.id);
  return {
    plans: await BillingService.offeredPlans(invoice),
    chosenPlan: invoice.paymentPlanKey || null,
    schedule: (doc?.instalments || []).map((p) => ({ sequence: p.sequence, label: p.label, amount: p.amount, dueDate: p.dueDate, remaining: p.remaining, state: p.state })),
    next: doc?.paymentPlan?.next || null,
  };
}

const MpesaService = {
  // For the client: whether to show the M-Pesa buttons, and what to tell people paying by hand —
  // for the caller's own workspace.
  async status(req) {
    const account = await MpesaAccounts.forOwner(req?.user?.role === "admin" ? req.ownerAdminId : null);
    if (!isConfigured(account)) return { enabled: false, ownPaybill: account.id !== "env" };
    return {
      enabled: true, paybill: account.shortcode, accountLabel: account.accountLabel, environment: account.environment, maxAmount: account.maxAmount,
      ownPaybill: account.id !== "env", canQuery: canQueryTransactions(account), canPayOut: canPayOut(account),
    };
  },

  // Pay with M-Pesa on an invoice (a parent) or Request payment (staff). Anyone who can open the
  // invoice can start one.
  async initiateForInvoice(invoiceId, { phone, amount }, req) {
    const invoice = await BillingService.getInvoice(invoiceId, req); // access check
    return startPrompt(invoice, { phone, amount, initiatedBy: req.user.id });
  },

  // Pay now on the "payment pending" screen: the signed-in family's own sign-up invoice, whatever
  // kind of login they used (a child's own login can't open invoices otherwise).
  async initiateForPendingSignup({ phone, amount }, req) {
    const AuthService = require("../../auth/auth.service");
    const user = await require("../../auth/user.model").findById(req.user.id);
    const pending = await AuthService.getPendingPayment(user);
    if (!pending?.invoiceId) fail("There's no sign-up payment waiting on this account", 404);
    const invoice = await BillingModel.findInvoiceById(pending.invoiceId);
    if (!invoice) fail("Invoice not found", 404);
    return startPrompt(invoice, { phone, amount, initiatedBy: req.user.id });
  },

  async getRequest(requestId, req) {
    const request = await MpesaModel.findRequestById(requestId);
    if (!request) fail("Payment request not found", 404);
    if (request.initiatedBy !== req.user.id) await BillingService.getInvoice(request.invoiceId, req); // access check
    return pollRequest(request);
  },

  // ---- Paying from a link, without signing in (the website's Pay now) ----

  // What the link's page shows: the invoice's number and what's left to pay. No names.
  async linkSummary(token) {
    const link = await PaymentLinks.resolve(token);
    const invoice = await BillingModel.findInvoiceById(link.invoiceId);
    if (!invoice) fail("This payment link isn't valid", 404);
    const due = money(Number(invoice.total) - Number(invoice.amountPaid || 0));
    const payable = PAYABLE.includes(invoice.status) && due > 0;
    const payBy = payable ? await paymentInstructions(invoice) : null;
    return {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currency: invoice.currency || "KES",
      total: money(invoice.total),
      amountDue: Math.max(0, due),
      paid: invoice.status === "paid",
      mpesa: payBy ? { enabled: true, ...payBy } : { enabled: false },
      // Every way to pay it (payment-options.js) and the "I've paid" notices sent for it.
      methods: payable ? await PaymentOptions.forInvoice(invoice) : [],
      // Part payments: the plans the family may still choose (before anything is paid), the one
      // chosen, and the schedule with the next part to pay (billing.instalments.js).
      ...(await linkPlanView(invoice)),
      notices: await require("../payment-notices.service").listForInvoice(invoice.id),
    };
  },

  async initiateForLink(token, { phone, amount }) {
    const link = await PaymentLinks.resolve(token);
    const invoice = await BillingModel.findInvoiceById(link.invoiceId);
    if (!invoice) fail("This payment link isn't valid", 404);
    const view = await startPrompt(invoice, { phone, amount, linkId: link.id });
    PaymentLinks.touch(link.id);
    return view;
  },

  async getRequestForLink(token, requestId) {
    const link = await PaymentLinks.resolve(token);
    const request = await MpesaModel.findRequestById(requestId);
    if (!request || request.invoiceId !== link.invoiceId) fail("Payment request not found", 404);
    return pollRequest(request);
  },

  // ---- Safaricom's calls (mpesa-callback.routes.js). None of these throw. ----

  // Safaricom's answer to a prompt sent from `account`.
  async handleStkCallback(body, account = MpesaAccounts.installation()) {
    const cb = body?.Body?.stkCallback;
    if (!cb?.CheckoutRequestID) return;
    const request = await MpesaModel.findRequestByCheckoutId(cb.CheckoutRequestID);
    if (!request || !MpesaAccounts.sameAccount(request.accountId, MpesaAccounts.idOf(account))) {
      console.warn("[mpesa] callback for a prompt we didn't send:", cb.CheckoutRequestID);
      return;
    }
    const resultCode = String(cb.ResultCode);
    if (request.status === "successful") {
      // A repeat — unless a status check settled the prompt first, in which case this callback
      // brings the M-Pesa receipt that check couldn't (settlePrompt only links it, never pays again).
      const details = callbackDetails(body);
      if (resultCode === "0" && details.receipt && !request.mpesaReceiptNumber) {
        await settlePrompt(request, { ...details, amount: details.amount ?? request.amount });
      }
      return;
    }
    await MpesaModel.updateRequest(request.id, { resultCode, resultDesc: String(cb.ResultDesc || "").slice(0, 255), callbackPayload: body });
    if (resultCode !== "0") {
      // A late failure never overrides a prompt a status check already found paid.
      await db("mpesa_stk_requests").where({ id: request.id }).whereNot({ status: "successful" }).update({ status: describeStkResult(resultCode).status, updatedAt: new Date() });
      return;
    }

    // "Paid" — before crediting anything, ask Safaricom to confirm it (the callback URL is
    // public, so its word alone isn't enough). If Safaricom can't be asked right now, the prompt
    // stays pending and the reconcile job or the payer's screen asks again shortly.
    if (settings.verifyCallbacks) {
      let confirmed;
      try {
        confirmed = await MpesaClient.stkQuery(account, request.checkoutRequestId);
      } catch (err) {
        console.warn(`[mpesa] couldn't confirm prompt ${request.id} yet (${err.message}); it will be checked again`);
        return;
      }
      if (confirmed.resultCode === null) return;
      if (confirmed.resultCode !== "0") {
        console.warn(`[mpesa] prompt ${request.id}: the callback said paid, but Safaricom's status check says ${confirmed.resultCode} (${confirmed.resultDesc})`);
        await db("mpesa_stk_requests").where({ id: request.id }).whereNot({ status: "successful" })
          .update({ status: describeStkResult(confirmed.resultCode).status, resultCode: confirmed.resultCode, resultDesc: `Not confirmed by M-Pesa: ${confirmed.resultDesc || ""}`.slice(0, 255), updatedAt: new Date() });
        return;
      }
    }
    const fresh = await MpesaModel.findRequestById(request.id);
    if (fresh.status === "successful") return;
    const details = callbackDetails(body);
    await settlePrompt(fresh, { ...details, amount: details.amount ?? request.amount, raw: body });
  },

  // Safaricom checking a Paybill payment before accepting it. We accept everything: turning a
  // parent's money away over a typo is worse than matching it by hand.
  validateC2b() {
    return { ResultCode: "0", ResultDesc: "Accepted" };
  },

  // Money paid straight to `account`'s Paybill.
  async handleC2bConfirmation(body, account = MpesaAccounts.installation()) {
    const transId = body?.TransID ? String(body.TransID) : null;
    const amount = money(body?.TransAmount);
    if (!transId || !(amount > 0)) return;
    // A notification for a different shortcode than this account's is ignored.
    if (body.BusinessShortCode && account.shortcode && String(body.BusinessShortCode) !== String(account.shortcode)) {
      console.warn(`[mpesa] Paybill notification for ${body.BusinessShortCode} arrived on the URL of ${account.shortcode}; ignored`);
      return;
    }
    const payerName = [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(" ").trim() || null;
    await recordIncoming(account, {
      source: "c2b", transId, transTime: parseDarajaTimestamp(body.TransTime), amount, msisdn: body.MSISDN || null, payerName,
      billRefNumber: String(body.BillRefNumber || "").trim().slice(0, 60) || null, shortcode: body.BusinessShortCode ? String(body.BusinessShortCode) : null, raw: body,
    });
  },

  // npm run mpesa:reconcile — every prompt still pending after a while is asked about; ones with
  // no answer after 15 minutes are marked timed out. Then payouts, status checks and reversals
  // still waiting for Safaricom's answer (mpesa.operations.js).
  async reconcile({ limit = 100 } = {}) {
    const pending = await MpesaModel.findPendingRequests({ olderThan: new Date(Date.now() - QUERY_AFTER_MS), limit });
    const counts = { checked: 0, successful: 0, failed: 0, timeout: 0, stillPending: 0 };
    for (const request of pending) {
      if (!request.checkoutRequestId) {
        // The prompt was never accepted by Safaricom (the server stopped mid-request).
        if (Date.now() - new Date(request.createdAt).getTime() > GIVE_UP_AFTER_MS) await MpesaModel.updateRequest(request.id, { status: "error", resultDesc: "The prompt was never sent" });
        continue;
      }
      const after = await checkPrompt(request);
      counts.checked += 1;
      if (after.status === "successful") counts.successful += 1;
      else if (after.status === "timeout") counts.timeout += 1;
      else if (after.status === "pending") counts.stillPending += 1;
      else counts.failed += 1;
    }
    const operations = await require("./mpesa.operations").expireStale();
    return { ...counts, operationsExpired: operations };
  },

  // ---- Staff: Billing → M-Pesa ----

  async listTransactions(req, { status, from, to } = {}) {
    assertWorkspace(req);
    const rows = await MpesaModel.listTransactions({ ownerAdminId: req.ownerAdminId, status: status || null, from: from ? new Date(from) : null, to: to ? new Date(to) : null });
    const operations = await MpesaModel.findOperationsForTransactions(rows.map((r) => r.id));
    const byTx = new Map();
    for (const op of operations) byTx.set(op.transactionId, [...(byTx.get(op.transactionId) || []), op]);
    return { transactions: rows.map((r) => transactionView(r, byTx.get(r.id) || [])), counts: await MpesaModel.countByStatus(req.ownerAdminId) };
  },

  // Prompts that didn't go through — so staff can see a parent tried and follow up.
  async listFailedRequests(req) {
    assertWorkspace(req);
    const rows = await MpesaModel.listRequests({ ownerAdminId: req.ownerAdminId, statuses: ["failed", "cancelled", "timeout", "error"], limit: 200 });
    const invoiceIds = [...new Set(rows.map((r) => r.invoiceId))];
    const invoices = invoiceIds.length ? await db("billing_invoices").whereIn("id", invoiceIds).select("id", "invoiceNumber") : [];
    const numberOf = new Map(invoices.map((i) => [i.id, i.invoiceNumber]));
    return rows.map((r) => ({ ...requestView(r), resultCode: r.resultCode, invoiceNumber: numberOf.get(r.invoiceId) || null }));
  },

  // Staff matching a waiting payment to an invoice, by its number or payment code.
  async allocateTransaction(id, { invoice: invoiceRef }, req) {
    const tx = await ownTransaction(id, req);
    if (!["unallocated", "partially_allocated"].includes(tx.status) || money(tx.unallocatedAmount) <= 0) fail("This payment has nothing left to match");
    const ref = String(invoiceRef || "").trim();
    const invoiceNumber = /^INV-\d{4}-\d+$/i.test(ref) ? ref.toUpperCase() : invoiceNumberFromAccount(ref);
    const invoice = invoiceNumber ? await db("billing_invoices").where({ invoiceNumber }).first() : null;
    if (!invoice) fail(`No invoice ${ref ? `"${ref}" ` : ""}was found`, 404);
    await BillingService.getInvoice(invoice.id, req); // must be one of this workspace's invoices
    if (!PAYABLE.includes(invoice.status)) fail(`Invoice ${invoice.invoiceNumber} is ${invoice.status.replace(/_/g, " ")} — nothing to pay`);
    const updated = await allocate(tx, invoice.id, { actorUserId: req.user.id, quiet: true });
    if (updated.note && money(updated.unallocatedAmount) === money(tx.unallocatedAmount)) fail(updated.note);
    return transactionView(updated);
  },

  // Money that will be dealt with outside the system (refunded, not ours) — off the waiting list.
  async ignoreTransaction(id, { note }, req) {
    const tx = await ownTransaction(id, req);
    if (!["unallocated", "partially_allocated"].includes(tx.status)) fail("Only a payment waiting to be matched can be set aside");
    const updated = await MpesaModel.updateTransaction(tx.id, { status: "ignored", note: String(note || "Set aside by staff").slice(0, 255), allocatedBy: req.user.id, allocatedAt: new Date() });
    return transactionView(updated);
  },

  // Billing → M-Pesa → Import statement: every customer payment in an M-Pesa statement that isn't
  // on file yet is recorded, and put on its invoice when the account number matches. With
  // `dryRun` nothing is written — it says what would happen.
  async importStatement(csvText, { dryRun = false } = {}, req) {
    assertWorkspace(req);
    const account = await MpesaAccounts.forOwner(req.ownerAdminId);
    if (!account.shortcode) fail("M-Pesa isn't set up for this workspace yet", 409);
    const parsed = parseStatement(csvText);
    if (parsed.error) fail(parsed.error);
    if (parsed.rows.length > STATEMENT_MAX_ROWS) fail(`That statement has ${parsed.rows.length} payments — import at most ${STATEMENT_MAX_ROWS} at a time (a shorter date range)`);

    const known = new Set(parsed.rows.length ? await db("mpesa_transactions").whereIn("transId", parsed.rows.map((r) => r.transId)).pluck("transId") : []);
    const counts = { total: parsed.rows.length, alreadyRecorded: 0, added: 0, matched: 0, toMatch: 0, skipped: parsed.skipped.length };
    const rows = [];
    for (const row of parsed.rows) {
      if (known.has(row.transId)) {
        counts.alreadyRecorded += 1;
        rows.push({ ...row, msisdn: maskPhone(row.msisdn), outcome: "already_recorded" });
        continue;
      }
      if (dryRun) {
        const invoiceNumber = invoiceNumberFromAccount(row.billRefNumber);
        rows.push({ ...row, msisdn: maskPhone(row.msisdn), outcome: "new", invoiceNumber });
        counts.added += 1;
        continue;
      }
      const { outcome } = await recordIncoming(account, {
        source: "statement_import", transId: row.transId, transTime: row.transTime, amount: row.amount, msisdn: row.msisdn,
        payerName: row.payerName, billRefNumber: row.billRefNumber ? row.billRefNumber.slice(0, 60) : null, raw: { statementLine: row.line, details: row.details },
        ownerAdminId: req.ownerAdminId,
      });
      if (outcome === "duplicate" || outcome === "linked") counts.alreadyRecorded += 1;
      else {
        counts.added += 1;
        if (outcome === "allocated") counts.matched += 1;
        else counts.toMatch += 1;
      }
      rows.push({ ...row, msisdn: maskPhone(row.msisdn), outcome });
    }
    return { dryRun, paybill: account.shortcode, counts, rows: rows.slice(0, 500), skipped: parsed.skipped.slice(0, 200) };
  },
};

module.exports = MpesaService;
module.exports._internal = { promptAmount, requestView, settlePrompt, allocate, recordIncoming, startPrompt, transactionView, ownTransaction };
