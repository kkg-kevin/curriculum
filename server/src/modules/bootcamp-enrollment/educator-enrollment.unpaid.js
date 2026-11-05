const db = require("../../config/db");
const BillingModel = require("../billing/billing.model");

// Website TOT sign-ups that were never paid (educator-enrollment.service.js). After
// TOT_UNPAID_RELEASE_DAYS (default 14) with nothing paid on the sign-up's invoice, its place is
// released:
//   - the invoice is cancelled (nothing is deleted — it stays in Billing as Cancelled);
//   - their place in that bootcamp's class is set inactive, as an admin's Withdraw does — only
//     that place, never training they have elsewhere; enrolling again resumes it, waiting on a
//     new payment;
//   - the enquiry is closed, with a note on its thread saying why;
//   - the educator is told (tot_place_released — bell and email).
// A TOT sign-up is a bootcamp invoice whose unpaid enquiry is an educator's own learner record
// (learners.teacherId) — so never an admin's enrolment (no invoice), nor one any payment has
// touched. Part of `npm run billing:process` (hourly); safe to run again — a released sign-up has
// nothing left owed.
const RELEASE_DAYS = Math.max(1, Number(process.env.TOT_UNPAID_RELEASE_DAYS) || 14);
const DAY_MS = 24 * 60 * 60 * 1000;

async function releaseUnpaidTotSignups({ now = new Date(), days = RELEASE_DAYS } = {}) {
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  const invoices = await db("billing_invoices as i")
    .where("i.invoiceType", "bootcamp")
    .whereIn("i.status", ["issued", "overdue"])
    .where("i.createdAt", "<", cutoff)
    .whereNotExists(db("billing_payments as p").whereRaw("p.invoiceId = i.id").select(db.raw("1")))
    .whereExists(db("leads as ld").join("learners as l", "l.id", "ld.learnerId").whereRaw("ld.invoiceId = i.id").whereNull("ld.paidAt").whereNotNull("l.teacherId").select(db.raw("1")))
    .select("i.id", "i.status", "i.invoiceNumber");

  const counts = { released: 0 };
  for (const invoice of invoices) {
    try {
      const at = new Date();
      await BillingModel.transaction(async (trx) => {
        await BillingModel.updateInvoice(invoice.id, { status: "cancelled" }, trx);
        await BillingModel.createAuditEvent({
          invoiceId: invoice.id, actorUserId: null, eventType: "invoice_cancelled", previousStatus: invoice.status, newStatus: "cancelled",
          metadata: { reason: `TOT sign-up not paid within ${days} days` },
        }, trx);
      });
      const leads = await db("leads").where({ invoiceId: invoice.id }).whereNull("paidAt").select("id", "status", "learnerId", "hubId", "bootcampId");
      for (const lead of leads) {
        // Only the place this sign-up made: their class at that hub, if it's one of the bootcamp's.
        const offering = lead.bootcampId && lead.hubId ? await db("bootcamp_hubs").where({ bootcampId: lead.bootcampId, hubId: lead.hubId }).first("classIds") : null;
        const classIds = offering ? (typeof offering.classIds === "string" ? JSON.parse(offering.classIds) : offering.classIds) || [] : [];
        const place = lead.learnerId && lead.hubId ? await db("learner_hub_links").where({ learnerId: lead.learnerId, hubId: lead.hubId }).first("id", "classId") : null;
        if (place && classIds.includes(place.classId)) await db("learner_hub_links").where({ id: place.id }).update({ status: "inactive", updatedAt: at });

        if (lead.status !== "closed") {
          await db("leads").where({ id: lead.id }).update({ status: "closed", updatedAt: at });
          await db("lead_messages").insert({
            id: require("crypto").randomUUID(), leadId: lead.id, direction: "note", subject: null, sentByUserId: null, createdAt: at,
            body: `Closed automatically: nothing was paid on invoice ${invoice.invoiceNumber} within ${days} days, so the invoice was cancelled and the training place released. Enrolling again resumes it.`,
          });
        }

        const bootcamp = lead.bootcampId ? await db("bootcamps").where({ id: lead.bootcampId }).first("name") : null;
        await require("../notifications/notification.service").notifyLearner(lead.learnerId, {
          type: "tot_place_released",
          title: "Your training place was released",
          message: `Nothing was paid on invoice ${invoice.invoiceNumber} within ${days} days, so your place on ${bootcamp?.name || "the training"} has been released and the invoice cancelled. To train, enrol again on the website.`,
          payload: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, route: "/learner-portal" },
          dedupeKey: `tot_place_released:${lead.id}`,
        }).catch(() => {});
      }
      counts.released += 1;
    } catch (err) {
      console.error(`[tot-unpaid] could not release invoice ${invoice.invoiceNumber}:`, err.message);
    }
  }
  return counts;
}

module.exports = { releaseUnpaidTotSignups, RELEASE_DAYS };
