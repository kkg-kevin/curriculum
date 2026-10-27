const db = require("../../config/db");
const LearnerModel = require("../learners/learner.model");
const { generateId } = require("../../shared/utils/model.utils");

// Pausing a family's learner accounts when a payment is overdue past the grace days (the workspace's
// partPayments.pauseAccess — see billing.process.js), and switching them back on once it's paid.
//
// A pause sets the learner's accountStatus to "pending_payment" — the same "please pay" screen a
// website sign-up waits on (auth.service.js's resolveSuspension / pendingPaymentDetails) — and
// records which invoice paused which learner (billing_access_pauses), so paying switches back on
// exactly those and never someone paused for another reason. A learner who isn't active (an unpaid
// sign-up, or deactivated by staff) is left alone. Hubs (business invoices) and Store orders are
// never paused.

const PAUSES = "billing_access_pauses";

// The learner accounts a family's invoice pays for: its learner, a Home Learning household's
// children, a Tech Club membership's children.
async function learnersOfInvoice(invoice) {
  if (!invoice || invoice.payerHubId || invoice.invoiceType === "store_order") return [];
  const ids = new Set();
  if (invoice.learnerId) ids.add(invoice.learnerId);
  if (invoice.householdId) (await db("home_learning_enrollments").where({ householdId: invoice.householdId }).pluck("learnerId")).forEach((id) => ids.add(id));
  if (invoice.clubMembershipId) (await db("club_membership_children").where({ membershipId: invoice.clubMembershipId }).pluck("learnerId")).forEach((id) => ids.add(id));
  return [...ids].filter(Boolean);
}

const BillingAccess = {
  learnersOfInvoice,

  // Pauses the invoice's active learners. Returns the ones paused now.
  async pauseForInvoice(invoice) {
    const now = new Date();
    const paused = [];
    for (const learnerId of await learnersOfInvoice(invoice)) {
      if (await db(PAUSES).where({ invoiceId: invoice.id, learnerId }).whereNull("resumedAt").first()) continue;
      const learner = await LearnerModel.findById(learnerId);
      if (!learner || (learner.accountStatus || "active") !== "active") continue;
      await LearnerModel.update(learnerId, { accountStatus: "pending_payment" });
      await db(PAUSES).insert({ id: generateId(), invoiceId: invoice.id, learnerId, pausedAt: now, createdAt: now, updatedAt: now });
      paused.push(learner);
    }
    return paused;
  },

  // Ends the invoice's pauses; each learner switches back on unless another invoice still has them
  // paused. Returns how many pauses ended.
  async resumeForInvoice(invoice) {
    const open = await db(PAUSES).where({ invoiceId: invoice.id }).whereNull("resumedAt");
    const now = new Date();
    for (const row of open) {
      await db(PAUSES).where({ id: row.id }).update({ resumedAt: now, updatedAt: now });
      if (await db(PAUSES).where({ learnerId: row.learnerId }).whereNull("resumedAt").first()) continue;
      const learner = await LearnerModel.findById(row.learnerId);
      if (learner?.accountStatus === "pending_payment") await LearnerModel.update(row.learnerId, { accountStatus: "active" });
    }
    return open.length;
  },

  // The invoice that has this learner paused, if any (for the "please pay" screen).
  async pausedInvoiceId(learnerId) {
    const row = await db(PAUSES).where({ learnerId }).whereNull("resumedAt").orderBy("pausedAt", "desc").first();
    return row?.invoiceId || null;
  },
};

module.exports = BillingAccess;
