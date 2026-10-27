const db = require("../../config/db");
const BillingModel = require("./billing.model");
const BillingAccess = require("./billing.access");
const { paymentPosition, reminderFor } = require("./billing.instalments");
const { sendPaymentReminderEmail } = require("./billing.emails");
const NotificationService = require("../notifications/notification.service");
const { todayInKenya } = require("../checkins/checkin.dates");

// Part payments, kept current (npm run billing:process — hourly; scripts/processBilling.js). For
// every invoice still owed something:
//   - its status follows its payments: "overdue" while a part of its schedule (or the whole
//     invoice, past its due date) is late, otherwise issued / partially paid;
//   - reminders, by email (Settings → Emails can switch them off) and in the payer's bell: a few
//     days before a part is due, on the day, the day after, and when the grace days run out
//     (billing.instalments.js's reminderFor) — each sent once (dedupe keys);
//   - a family whose payment is overdue past the grace days has its learner accounts paused, when
//     the workspace has that on, and switched back on once nothing is overdue (billing.access.js).
//     Hubs are reminded, never paused.
// Safe to run any number of times. A failure on one invoice is logged and the rest carry on.

const REMINDER_TITLE = { upcoming: "Payment due soon", due: "Payment due today", overdue: "Payment overdue", final: "Payment still overdue" };
const formatKes = (amount, currency) => `${currency || "KES"} ${Number(amount || 0).toLocaleString("en-KE")}`;

// `ownerAdminId` / `invoiceIds` narrow it to one workspace / some invoices.
async function processPartPayments({ ownerAdminId = null, invoiceIds = null, today = todayInKenya() } = {}) {
  const BillingService = require("./billing.service");
  const PaymentOptions = require("../payments/payment-options");
  const { invoiceOwnerId } = require("../payments/mpesa/mpesa.instructions");

  let query = db("billing_invoices").whereIn("status", ["issued", "partially_paid", "overdue"]);
  if (ownerAdminId) query = query.whereIn("hubId", db("learning_hubs").where({ ownerAdminId }).select("id"));
  if (invoiceIds) query = query.whereIn("id", invoiceIds.length ? invoiceIds : ["__none__"]);
  const invoices = await query;
  const settingsByOwner = new Map();
  const counts = { checked: 0, markedOverdue: 0, cleared: 0, reminders: 0, paused: 0, resumed: 0 };

  for (const invoice of invoices) {
    try {
      const instalments = await BillingModel.findInstalments(invoice.id);
      if (!instalments.length && !invoice.dueAt && invoice.status !== "overdue") continue;
      counts.checked += 1;
      const owner = await invoiceOwnerId(invoice);
      if (!settingsByOwner.has(owner)) settingsByOwner.set(owner, await PaymentOptions.partPaymentsFor(owner));
      const settings = settingsByOwner.get(owner);
      const paid = Number(invoice.amountPaid || 0);
      const position = paymentPosition(invoice, instalments, paid, today);

      const want = position.overdueAmount > 0 ? "overdue" : paid > 0 ? "partially_paid" : "issued";
      if (want !== invoice.status) {
        await BillingModel.updateInvoice(invoice.id, { status: want });
        await BillingModel.createAuditEvent({ invoiceId: invoice.id, eventType: want === "overdue" ? "marked_overdue" : "overdue_cleared", previousStatus: invoice.status, newStatus: want, amount: position.overdueAmount || null });
        counts[want === "overdue" ? "markedOverdue" : "cleared"] += 1;
      }

      const familyPauses = settings.pauseAccess && !invoice.payerHubId && invoice.invoiceType !== "store_order";
      let doc = null;
      for (const part of position.parts) {
        const kind = reminderFor(part, today, { daysBefore: settings.remindDaysBefore, graceDays: settings.graceDays });
        if (!kind) continue;
        doc = doc || (await BillingService.getInvoiceDocument(invoice.id));
        await sendPaymentReminderEmail(doc, part, kind, { pauses: kind === "final" && familyPauses });
        if (doc.payerUserId) {
          const what = part.whole ? `Invoice ${doc.invoiceNumber}` : `${part.label} on ${doc.invoiceNumber}`;
          await NotificationService._deliver(doc.payerUserId, {
            type: "payment_reminder",
            title: REMINDER_TITLE[kind],
            message: `${what}: ${formatKes(part.remaining, doc.currency)} ${kind === "upcoming" ? `due ${part.dueDate}` : kind === "due" ? "due today" : `was due ${part.dueDate}`}.`,
            payload: { invoiceId: doc.id, route: "/learner-portal/invoices/" },
            dedupeKey: `payment_reminder:${doc.id}:${part.sequence}:${part.dueDate}:${kind}`,
            ownerAdminId: owner,
          }).catch(() => {});
        }
        counts.reminders += 1;
      }

      if (familyPauses && position.overdueAmount > 0 && position.daysOverdue >= Math.max(1, Number(settings.graceDays) || 0)) {
        counts.paused += (await BillingAccess.pauseForInvoice(invoice)).length;
      } else if (position.overdueAmount === 0) {
        counts.resumed += await BillingAccess.resumeForInvoice(invoice);
      }
    } catch (err) {
      console.error(`[billing] could not bring invoice ${invoice.invoiceNumber} up to date:`, err.message);
    }
  }
  return counts;
}

module.exports = { processPartPayments };
