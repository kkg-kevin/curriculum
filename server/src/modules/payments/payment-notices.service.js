const db = require("../../config/db");
const { createRecord, firstOrNull } = require("../../shared/utils/model.utils");
const BillingModel = require("../billing/billing.model");
const NotificationService = require("../notifications/notification.service");
const PaymentLinks = require("./payment-links");
const PaymentOptions = require("./payment-options");
const { invoiceOwnerId } = require("./mpesa/mpesa.instructions");
const { normalisePhone } = require("./mpesa/mpesa.utils");

// A family saying "I've paid" — the last step of a website sign-up (Home Learning, Tech Club,
// Bootcamp), for every way of paying that can't be seen by itself: an M-Pesa code (Paybill until
// Daraja is live, or Send Money), a bank transfer, a cheque, or cash they'll bring. Nothing is
// put on the invoice until staff confirm it in Billing → To confirm; confirming records the
// payment through BillingService.applyPayment, so a fully paid sign-up switches on exactly as
// when staff use "Record payment" (billing.paid-hooks.js). An invoice paid any other way closes
// the notices still waiting on it (closeForPaidInvoice).
//
// An M-Pesa code is unique (dedupeKey), so the same code can't be claimed twice, and on
// confirming it becomes the payment's providerReference — a Paybill payment that M-Pesa reports
// itself later is then recognised as the same money.

const TABLE = "payment_notices";
const PAYABLE = ["issued", "partially_paid", "overdue"];
const MAX_PENDING_PER_INVOICE = 5;
const MPESA_CODE = /^[A-Z0-9]{10}$/;

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const money = (value) => Number(Number(value || 0).toFixed(2));
const formatKes = (value) => `KES ${money(value).toLocaleString("en-KE")}`;

// The billing service requires a lot (and, through the paid hooks, this file) — load it when used.
const billing = () => require("../billing/billing.service");

function assertWorkspace(req) {
  if (req.user.role !== "admin" || !req.ownerAdminId) fail("Only the workspace's billing staff can confirm payments", 403);
}

// The reference a method needs, cleaned up — or a sentence saying what's missing.
function cleanReference(method, reference) {
  const value = String(reference || "").trim();
  if (PaymentOptions.METHODS[method].mpesa) {
    const code = value.replace(/\s+/g, "").toUpperCase();
    if (!MPESA_CODE.test(code)) fail("Enter the M-Pesa code from your confirmation message — 10 letters and numbers, e.g. SJK3XYZ12A");
    return code;
  }
  if (method === "bank_transfer" && value.length < 3) fail("Enter the reference of your bank transfer");
  if (method === "cheque" && value.length < 3) fail("Enter the cheque number");
  return value || null;
}

// What the family sees about their own notices on the Payment step.
function publicView(row) {
  return {
    id: row.id,
    method: row.method,
    methodLabel: PaymentOptions.METHODS[row.method]?.label || row.method,
    reference: row.reference,
    amount: money(row.amount),
    status: row.status,
    reviewNote: row.status === "rejected" ? row.reviewNote : null,
    createdAt: row.createdAt,
  };
}

function staffView(row, invoice) {
  return {
    ...publicView(row),
    payerName: row.payerName,
    payerPhone: row.payerPhone,
    note: row.note,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt,
    paymentId: row.paymentId,
    invoice: invoice ? {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      status: invoice.status,
      total: money(invoice.total),
      amountDue: Math.max(0, money(Number(invoice.total) - Number(invoice.amountPaid || 0))),
    } : null,
  };
}

async function ownNotice(id, req) {
  assertWorkspace(req);
  const notice = await firstOrNull(db(TABLE).where({ id }));
  if (!notice || notice.ownerAdminId !== req.ownerAdminId) fail("Payment notice not found", 404);
  return notice;
}

const PaymentNotices = {
  // The family's notices on the invoice a payment link opens — shown back on the Payment step.
  async listForInvoice(invoiceId) {
    const rows = await db(TABLE).where({ invoiceId }).orderBy("createdAt", "desc").limit(20);
    return rows.map(publicView);
  },

  // "I've paid", from the website's Payment step (no sign-in: the payment link is the key).
  async submitForLink(token, { method, reference, amount, phone, note }) {
    const link = await PaymentLinks.resolve(token);
    const invoice = await BillingModel.findInvoiceById(link.invoiceId);
    if (!invoice) fail("This payment link isn't valid", 404);
    const due = money(Number(invoice.total) - Number(invoice.amountPaid || 0));
    if (!PAYABLE.includes(invoice.status) || due <= 0) fail(invoice.status === "paid" ? "This invoice is already paid — thank you!" : "This invoice can't be paid any more", 409);

    const offered = await PaymentOptions.forInvoice(invoice);
    if (!offered.some((m) => m.key === method)) fail("That way of paying isn't available for this invoice");
    const ref = cleanReference(method, reference);
    const paid = amount ? money(amount) : due;
    if (paid > due) fail(`That's more than is due on this invoice (${formatKes(due)})`);

    const pending = await db(TABLE).where({ invoiceId: invoice.id, status: "pending" }).select("id", "method");
    // Saying "I'll pay in cash" twice is the same message.
    const sameCash = method === "cash" && pending.length ? await firstOrNull(db(TABLE).where({ invoiceId: invoice.id, status: "pending", method: "cash" })) : null;
    if (sameCash) return publicView(sameCash);
    if (pending.length >= MAX_PENDING_PER_INVOICE) fail("We already have several payments from you waiting to be confirmed. Our team will be in touch.", 429);

    const mpesa = PaymentOptions.METHODS[method].mpesa;
    if (mpesa && (await firstOrNull(db("billing_payments").where({ providerReference: ref }).select("invoiceId")))) {
      fail("We've already received the payment with this M-Pesa code.", 409);
    }

    const payer = await billing().resolvePayerIdentity(invoice).catch(() => null);
    const ownerAdminId = await invoiceOwnerId(invoice);
    let notice;
    try {
      notice = await createRecord(db, TABLE, {
        ownerAdminId, invoiceId: invoice.id, linkId: link.id, method, status: "pending", reference: ref,
        dedupeKey: mpesa ? `mpesa:${ref}` : null, amount: paid,
        payerName: payer?.name ? String(payer.name).slice(0, 150) : null,
        payerPhone: normalisePhone(phone) || normalisePhone(payer?.phone) || null,
        note: note || null,
      });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") fail("This M-Pesa code has already been sent to us. If it's yours, our team will confirm it soon.", 409);
      throw err;
    }
    PaymentLinks.touch(link.id);

    const label = PaymentOptions.METHODS[method].label;
    await NotificationService._notify(ownerAdminId, {
      type: "payment_notice_submitted",
      title: "Payment to confirm",
      message: method === "cash"
        ? `${notice.payerName || "A family"} will pay ${formatKes(paid)} in cash for ${invoice.invoiceNumber}. Confirm it in Billing → To confirm once it's received.`
        : `${notice.payerName || "A family"} says they paid ${formatKes(paid)} by ${label} for ${invoice.invoiceNumber}${ref ? ` (${ref})` : ""}. Check it and confirm it in Billing → To confirm.`,
      payload: { route: "/billing?tab=confirm" },
      dedupeKey: `payment_notice:${notice.id}`,
      ownerAdminId,
    }).catch(() => {});
    return publicView(notice);
  },

  // Billing → To confirm.
  async list(req, { status = "pending" } = {}) {
    assertWorkspace(req);
    let query = db(TABLE).where({ ownerAdminId: req.ownerAdminId }).orderBy("createdAt", status === "pending" ? "asc" : "desc").limit(300);
    if (status !== "all") query = query.andWhere({ status });
    const rows = await query;
    const invoiceIds = [...new Set(rows.map((r) => r.invoiceId))];
    const invoices = invoiceIds.length ? await db("billing_invoices").whereIn("id", invoiceIds) : [];
    const byId = new Map(invoices.map((i) => [i.id, i]));
    const counts = Object.fromEntries((await db(TABLE).where({ ownerAdminId: req.ownerAdminId }).groupBy("status").select("status").count({ count: "*" })).map((r) => [r.status, Number(r.count)]));
    return { notices: rows.map((r) => staffView(r, byId.get(r.invoiceId))), counts };
  },

  // The money is in: record it on the invoice (which switches a fully paid sign-up on).
  async confirm(id, { amount, paymentDate, note }, req) {
    const notice = await ownNotice(id, req);
    if (notice.status !== "pending") fail("This payment notice has already been dealt with", 409);
    await billing().getInvoice(notice.invoiceId, req); // must be one of this workspace's invoices
    const method = PaymentOptions.METHODS[notice.method];
    const date = paymentDate ? new Date(paymentDate) : new Date();
    if (Number.isNaN(date.getTime())) fail("Payment date is invalid");

    let paymentId;
    const already = method.mpesa ? await firstOrNull(db("billing_payments").where({ providerReference: notice.reference })) : null;
    if (already) {
      // M-Pesa told us about this payment itself (or staff recorded it) — nothing more to record.
      if (already.invoiceId !== notice.invoiceId) fail(`M-Pesa code ${notice.reference} is already recorded on another invoice`, 409);
      paymentId = already.id;
    } else {
      const { payment } = await billing().applyPayment(notice.invoiceId, {
        amount: amount ? money(amount) : money(notice.amount),
        provider: "manual",
        paymentMethod: method.paymentMethod,
        providerReference: method.mpesa ? notice.reference : null,
        paymentDate: date,
        recordedBy: req.user.id,
        idempotencyKey: `payment_notice:${notice.id}`,
        notes: [`${method.label}${notice.reference ? ` ${notice.reference}` : ""}, confirmed from the family's payment notice`, note].filter(Boolean).join(" — ").slice(0, 1000),
        metadata: { paymentNoticeId: notice.id, reference: notice.reference },
      });
      paymentId = payment.id;
    }
    await db(TABLE).where({ id }).update({ status: "confirmed", paymentId, reviewedBy: req.user.id, reviewedAt: new Date(), reviewNote: note || null, updatedAt: new Date() });
    const updated = await firstOrNull(db(TABLE).where({ id }));
    return staffView(updated, await BillingModel.findInvoiceById(notice.invoiceId));
  },

  // The money isn't there (wrong code, transfer never arrived): the family is told why.
  async reject(id, { reason }, req) {
    const notice = await ownNotice(id, req);
    if (notice.status !== "pending") fail("This payment notice has already been dealt with", 409);
    // The code is freed, so a family who made a mistake (the wrong amount, say) can send it again.
    await db(TABLE).where({ id }).update({ status: "rejected", dedupeKey: null, reviewedBy: req.user.id, reviewedAt: new Date(), reviewNote: reason, updatedAt: new Date() });
    const invoice = await BillingModel.findInvoiceById(notice.invoiceId);
    if (invoice?.payerUserId) {
      await NotificationService.notifyPerson(invoice.payerUserId, {
        type: "payment_notice_rejected",
        title: "We couldn't confirm your payment",
        message: `Your ${PaymentOptions.METHODS[notice.method]?.label || "payment"} of ${formatKes(notice.amount)} for ${invoice.invoiceNumber}${notice.reference ? ` (${notice.reference})` : ""} couldn't be confirmed: ${reason}`,
        payload: { invoiceId: invoice.id },
        dedupeKey: `payment_notice_rejected:${notice.id}`,
        ownerAdminId: notice.ownerAdminId,
      }).catch(() => {});
    }
    return staffView(await firstOrNull(db(TABLE).where({ id })), invoice);
  },

  // An invoice paid in full some other way (an M-Pesa payment that arrived by itself, staff using
  // "Record payment" or a sign-up's Approve) — nothing left to confirm on it.
  closeForPaidInvoice(invoice) {
    return db(TABLE).where({ invoiceId: invoice.id, status: "pending" })
      .update({ status: "closed", reviewNote: "The invoice was paid in full.", reviewedAt: new Date(), updatedAt: new Date() });
  },
};

module.exports = PaymentNotices;
module.exports._internal = { cleanReference };
