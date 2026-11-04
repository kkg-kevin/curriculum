const db = require("../../config/db");
const BillingModel = require("../billing/billing.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const UserModel = require("../auth/user.model");
const NotificationService = require("../notifications/notification.service");
const PaymentOptions = require("../payments/payment-options");
const PathwayAccess = require("./pathway-access");
const { PathwayPackageModel, PathwaySubscriptionModel } = require("./pathway-subscription.model");
const { priceForPackage, toPublicPackage, CURRENCY } = require("../home-learning/home-learning.pricing");
const { kenyaToday } = require("../../shared/utils/age");
const { addDays, scheduleChange, periodLabel, PERIODS } = require("../../shared/utils/billing-periods");
const { slugify } = require("../../shared/utils/slugify");

// Website pathways sold by subscription (4 Nov 2026). A pathway's plans live in Billing → Packages →
// Pathways (pathway_packages, one pathway each); a family subscribing is one pathway_subscriptions
// row with its children, billed every period like the other packages (billing/package-billing.js —
// in advance, from the day they join, automatically). What a subscription buys is ACCESS: every
// child on it may open the pathway's courses (pathway-access.js) up to the end of the last paid
// period plus the workspace's grace days (Settings → Payments → Part payments → graceDays). No class
// is needed — it's self-paced; a hub class is an optional extra staff can add.
//   - pending: signed up, first invoice not paid yet (the children's courses show locked)
//   - active: billed every period; paying a period moves accessUntil on
//   - paused: a period went unpaid past the grace days — its unpaid invoice is cancelled (no family
//     owes for time without access), billing stops, the courses lock; Renew starts afresh today
//   - cancelled: by staff, or a sign-up never paid within RELEASE_DAYS
// The account itself is never touched (accountStatus): a lapse locks only this pathway.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const money = (v) => Number(Number(v || 0).toFixed(2));
const OPEN = ["issued", "partially_paid", "overdue"];
// A sign-up whose first invoice isn't paid within this many days is cancelled.
const RELEASE_DAYS = Math.max(1, Number(process.env.PATHWAY_UNPAID_RELEASE_DAYS) || 14);
// Daily plans are left out: they bill the days attended, which doesn't fit online access.
const PLAN_PERIODS = PERIODS.filter((p) => p !== "daily");

async function graceDaysFor(ownerAdminId) {
  const grace = Number((await PaymentOptions.partPaymentsFor(ownerAdminId).catch(() => null))?.graceDays);
  return Number.isFinite(grace) && grace >= 0 ? grace : 7;
}

async function nextInvoiceNumber(trx) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`;
}

// The catalogue entry a plan sells — one of this workspace's.
async function templateOf(ownerAdminId, pathwayTemplateId) {
  const entry = await db("pathway_templates").where({ id: pathwayTemplateId, ownerAdminId }).first();
  if (!entry) fail("Choose one of your pathways", 404);
  return entry;
}

function cleanPackageInput(input) {
  const childrenIncluded = Math.max(1, Math.round(Number(input.childrenIncluded) || 1));
  const allowExtraChildren = !!input.allowExtraChildren;
  const maxChildren = allowExtraChildren ? Math.max(childrenIncluded, Math.round(Number(input.maxChildren) || childrenIncluded)) : childrenIncluded;
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) fail("Enter the plan's price");
  const billingPeriod = PLAN_PERIODS.includes(input.billingPeriod) ? input.billingPeriod : "monthly";
  const name = String(input.name || "").trim();
  if (!name) fail("Give the plan a name");
  return {
    name: name.slice(0, 150),
    summary: input.summary ? String(input.summary).slice(0, 300) : null,
    description: input.description ? String(input.description) : null,
    childrenIncluded,
    amount,
    allowExtraChildren,
    extraChildAmount: allowExtraChildren ? Math.max(0, Math.round(Number(input.extraChildAmount) || 0)) : null,
    maxChildren,
    billingPeriod,
    features: Array.isArray(input.features) ? input.features.map((f) => String(f).trim()).filter(Boolean).slice(0, 12) : [],
    badge: input.badge ? String(input.badge).slice(0, 40) : null,
    isPublished: !!input.isPublished,
    status: input.status === "archived" ? "archived" : "active",
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.round(Number(input.sortOrder)) : 0,
  };
}

async function uniqueSlug(ownerAdminId, name, ignoreId = null) {
  const base = slugify(name) || "plan";
  for (let i = 0; i < 50; i += 1) {
    const slug = i ? `${base}-${i + 1}` : base;
    const clash = await PathwayPackageModel.findBySlug(slug, ownerAdminId);
    if (!clash || clash.id === ignoreId) return slug;
  }
  return `${base}-${Date.now()}`;
}

// One subscription's invoice (issued) for one billing period — shared by the automatic invoicing
// (billing/package-billing.js), "Invoice next period", a renewal and a website sign-up. Issued by
// the subscription's hub to the parent; emailed.
async function raiseSubscriptionInvoice(sub, { periodStart, periodEnd, label, dueDate, quantity = 1, unitAmount = sub.amount }, actorUserId = null) {
  const payer = sub.guardianEmail ? await UserModel.findByEmail(sub.guardianEmail) : null;
  const amount = money(Number(unitAmount) * quantity);
  const children = await PathwaySubscriptionModel.activeLearnerIds(sub.id);
  const invoice = await BillingModel.transaction(async (trx) => {
    const created = await BillingModel.createInvoice({
      invoiceNumber: await nextInvoiceNumber(trx),
      issuerType: "learning_hub", issuerHubId: sub.hubId, payerUserId: payer?.role === "learner" ? payer.id : null, payerHubId: null,
      learnerId: null, hubId: sub.hubId, pathwaySubscriptionId: sub.id, invoiceType: "pathway_subscription", status: "issued",
      currency: CURRENCY, subtotal: amount, discount: 0, total: amount, amountPaid: 0,
      periodStart, periodEnd, periodLabel: `${sub.pathwayName} · ${label}`,
      issuedAt: new Date(), dueAt: dueDate ? new Date(`${dueDate}T00:00:00`) : null, notes: null,
    }, trx);
    await BillingModel.createItem({
      invoiceId: created.id, learnerId: null, courseId: null,
      description: `${sub.pathwayName} subscription (${sub.childCount === 1 ? "1 child" : `${sub.childCount} children`}) — ${label}`,
      quantity, unitAmount: money(unitAmount), totalAmount: amount,
      metadata: { pathwaySubscriptionId: sub.id, packageId: sub.packageId, childCount: sub.childCount, learnerIds: children },
    }, trx);
    await BillingModel.createAuditEvent({ invoiceId: created.id, actorUserId, eventType: "invoice_issued", newStatus: "issued", amount, metadata: { source: "pathway_subscription" } }, trx);
    return created;
  });
  require("../billing/billing.service").emailIssuedInvoice(invoice.id);
  return invoice;
}

// The parent's login, by the email they signed up with.
async function parentUserIdOf(sub) {
  const user = sub.guardianEmail ? await UserModel.findByEmail(sub.guardianEmail) : null;
  return user?.id || null;
}

// Every child's access moved to the subscription's paid-through date plus the grace days.
async function syncAccess(sub, { status = "active" } = {}) {
  const grace = await graceDaysFor(sub.ownerAdminId);
  const until = sub.accessUntil ? addDays(sub.accessUntil, grace) : null;
  for (const learnerId of await PathwaySubscriptionModel.activeLearnerIds(sub.id)) {
    await PathwayAccess.grant({
      ownerAdminId: sub.ownerAdminId, learnerId, curriculumId: sub.curriculumId, pathwayTemplateId: sub.pathwayTemplateId,
      pathwayName: sub.pathwayName, source: "subscription", subscriptionId: sub.id, accessUntil: until,
    });
  }
  // grant() keeps the later of two dates; a lapse or cancellation sets them outright.
  if (status !== "active") await PathwayAccess.setForSubscription(sub.id, { accessUntil: until, status });
}

async function summaries(subs) {
  const ids = subs.map((s) => s.id);
  const children = await PathwaySubscriptionModel.childrenOf(ids);
  const learnerIds = [...new Set(children.map((c) => c.learnerId))];
  const learners = learnerIds.length ? await db("learners").whereIn("id", learnerIds).select("id", "firstName", "lastName", "username") : [];
  const invoices = ids.length ? await db("billing_invoices").whereIn("pathwaySubscriptionId", ids).whereNotIn("status", ["draft", "void"]).orderBy("periodStart", "desc") : [];
  const plans = new Map();
  for (const sub of subs) if (sub.packageId && !plans.has(sub.packageId)) plans.set(sub.packageId, await PathwayPackageModel.findById(sub.packageId));
  const hubs = new Map();
  for (const sub of subs) if (sub.hubId && !hubs.has(sub.hubId)) hubs.set(sub.hubId, await LearningHubModel.findById(sub.hubId));
  const today = kenyaToday();
  return subs.map((sub) => {
    const own = invoices.filter((inv) => inv.pathwaySubscriptionId === sub.id);
    const open = own.filter((inv) => OPEN.includes(inv.status));
    return {
      ...sub,
      planName: plans.get(sub.packageId)?.name || null,
      hubName: hubs.get(sub.hubId)?.name || null,
      accessOpen: Boolean(sub.accessUntil) && sub.accessUntil >= today && sub.status === "active",
      children: children.filter((c) => c.subscriptionId === sub.id).map((c) => {
        const l = learners.find((x) => x.id === c.learnerId);
        return { learnerId: c.learnerId, status: c.status, name: l ? [l.firstName, l.lastName].filter(Boolean).join(" ") : "Learner", username: l?.username || null };
      }),
      outstanding: money(open.reduce((sum, inv) => sum + Number(inv.total) - Number(inv.amountPaid), 0)),
      invoices: own.slice(0, 6).map((inv) => ({ id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status, periodLabel: inv.periodLabel, periodStart: inv.periodStart, total: money(inv.total), amountPaid: money(inv.amountPaid), dueAt: inv.dueAt })),
      outlook: require("../billing/package-billing").billingOutlook(sub),
    };
  });
}

const PathwaySubscriptionService = {
  PLAN_PERIODS,
  RELEASE_DAYS,
  raiseSubscriptionInvoice,
  syncAccess,

  /* ── Plans (Billing → Packages → Pathways) ─────────────────────────────── */

  async listPackages(ownerAdminId, { pathwayTemplateId = null } = {}) {
    const plans = await PathwayPackageModel.findAll(ownerAdminId, { pathwayTemplateId });
    const names = new Map((await db("pathway_templates").where({ ownerAdminId }).select("id", "name")).map((t) => [t.id, t.name]));
    const out = [];
    for (const plan of plans) out.push({ ...plan, pathwayName: names.get(plan.pathwayTemplateId) || null, subscriptions: await PathwayPackageModel.countSubscriptions(plan.id) });
    return out;
  },

  async createPackage(ownerAdminId, input) {
    await templateOf(ownerAdminId, input.pathwayTemplateId);
    const data = cleanPackageInput(input);
    return PathwayPackageModel.create({ ...data, ownerAdminId, pathwayTemplateId: input.pathwayTemplateId, slug: await uniqueSlug(ownerAdminId, data.name) });
  },

  // A price or period change applies to new subscriptions at once; existing ones keep theirs until
  // staff change their plan (from their next period).
  async updatePackage(ownerAdminId, id, input) {
    const existing = await PathwayPackageModel.findById(id, ownerAdminId);
    if (!existing) fail("Plan not found", 404);
    const pathwayTemplateId = input.pathwayTemplateId || existing.pathwayTemplateId;
    await templateOf(ownerAdminId, pathwayTemplateId);
    const data = cleanPackageInput({ ...existing, ...input });
    const slug = data.name !== existing.name ? await uniqueSlug(ownerAdminId, data.name, id) : existing.slug;
    return PathwayPackageModel.update(id, { ...data, pathwayTemplateId, slug });
  },

  // A plan someone subscribes on is archived instead (unpublished, kept for their invoices).
  async deletePackage(ownerAdminId, id) {
    const existing = await PathwayPackageModel.findById(id, ownerAdminId);
    if (!existing) fail("Plan not found", 404);
    if (await PathwayPackageModel.countSubscriptions(id)) {
      await PathwayPackageModel.update(id, { status: "archived", isPublished: false });
      return { archived: true };
    }
    await PathwayPackageModel.delete(id);
    return { deleted: true };
  },

  // The website's plans for one pathway (its catalogue entry), cheapest first.
  async publicPackagesFor(ownerAdminId, pathwayTemplateId) {
    if (!pathwayTemplateId) return [];
    return (await PathwayPackageModel.findAll(ownerAdminId, { pathwayTemplateId, publishedOnly: true })).map(toPublicPackage);
  },

  priceFor(plan, childCount) {
    return priceForPackage(plan, childCount);
  },

  /* ── Subscriptions ─────────────────────────────────────────────────────── */

  async list(ownerAdminId, { status = null, pathwayTemplateId = null } = {}) {
    return summaries(await PathwaySubscriptionModel.findAll(ownerAdminId, { status, pathwayTemplateId }));
  },

  async get(ownerAdminId, id) {
    const sub = await PathwaySubscriptionModel.findById(id, ownerAdminId);
    if (!sub) fail("Subscription not found", 404);
    return (await summaries([sub]))[0];
  },

  // A parent's subscriptions (their own login's email) — the parent portal and the learner pages.
  async forParentEmail(email) {
    return summaries(await PathwaySubscriptionModel.findByGuardianEmail(email));
  },

  // Staff: pause (billing stops, access ends now), cancel, or switch it back on (starting afresh
  // today unless the period already paid for is still running).
  async setStatus(ownerAdminId, id, status, actorUserId = null) {
    const sub = await PathwaySubscriptionModel.findById(id, ownerAdminId);
    if (!sub) fail("Subscription not found", 404);
    if (!["active", "paused", "cancelled"].includes(status)) fail("Unknown status");
    if (status === sub.status) return this.get(ownerAdminId, id);
    if (status === "active") return this.renew(ownerAdminId, id, { actorUserId });
    const today = kenyaToday();
    const updated = await PathwaySubscriptionModel.update(id, {
      status, ...(status === "paused" ? { pausedAt: new Date() } : { cancelledAt: new Date() }),
    });
    // Access ends today (the time already paid for is not refunded here — staff refund by hand).
    await PathwayAccess.setForSubscription(id, { accessUntil: addDays(today, -1), status: "active" });
    await cancelUnpaidInvoices(updated, actorUserId, status === "paused" ? "Subscription paused" : "Subscription cancelled");
    return this.get(ownerAdminId, id);
  },

  // A plan or price change for an active subscription, from its next period (billing-periods.js).
  async changePlan(ownerAdminId, id, { packageId }) {
    const sub = await PathwaySubscriptionModel.findById(id, ownerAdminId);
    if (!sub) fail("Subscription not found", 404);
    const plan = await PathwayPackageModel.findById(packageId, ownerAdminId);
    if (!plan || plan.pathwayTemplateId !== sub.pathwayTemplateId) fail("Choose one of this pathway's plans");
    const price = priceForPackage(plan, sub.childCount);
    if (!price) fail(`${plan.name} doesn't take ${sub.childCount} children`);
    const change = scheduleChange(sub, { amount: price.amount, billingPeriod: price.billingPeriod });
    await PathwaySubscriptionModel.update(id, { packageId: plan.id, ...change });
    return this.get(ownerAdminId, id);
  },

  // Renew / switch back on: a paused, cancelled or lapsed subscription starts afresh today — its
  // first period's invoice is raised now and access opens once it's paid. Returns the invoice too.
  async renew(ownerAdminId, id, { actorUserId = null } = {}) {
    const sub = await PathwaySubscriptionModel.findById(id, ownerAdminId);
    if (!sub) fail("Subscription not found", 404);
    const today = kenyaToday();
    const open = await db("billing_invoices").where({ pathwaySubscriptionId: id }).whereIn("status", OPEN).orderBy("periodStart", "desc").first();
    if (sub.status === "active" || sub.status === "pending") {
      // Nothing to restart: point them at what's owed.
      return { subscription: await this.get(ownerAdminId, id), invoice: open || null };
    }
    // Decided by what's PAID, not what was invoiced: a lapse cancels its unpaid period, so the
    // billed-through date can't be trusted here. Still inside a paid period: carry on (the next
    // invoice comes at its end). Otherwise a fresh period starts today, on any change that was
    // waiting for it.
    const paidOn = Boolean(sub.accessUntil) && sub.accessUntil >= today;
    const pending = sub.pendingBilling;
    const patch = {
      status: "active", pausedAt: null, cancelledAt: null,
      ...(paidOn
        ? { billedThrough: sub.accessUntil }
        : { billingAnchor: today, billedThrough: addDays(today, -1), ...(pending ? { amount: pending.amount, billingPeriod: pending.billingPeriod, pendingBilling: null } : {}) }),
    };
    const updated = await PathwaySubscriptionModel.update(id, patch);
    // Back inside a period already paid for: access opens again straight away.
    if (updated.accessUntil && updated.accessUntil >= today) await syncAccess(updated);
    const billed = await require("../billing/package-billing").billFamily("pathway_subscription", updated, { today, actorUserId });
    const invoice = await db("billing_invoices").where({ pathwaySubscriptionId: id }).whereIn("status", OPEN).orderBy("periodStart", "desc").first();
    return { subscription: await this.get(ownerAdminId, id), invoice: invoice || null, raised: billed };
  },

  // Enough of a subscription's invoice is paid (billing.paid-hooks.js): it's active, its access
  // runs to the end of that period (plus grace), and — the first time — the family and the admins
  // are told. Does nothing for any other invoice.
  async activateForPaidInvoice(invoice, { paidByUserId = null } = {}) {
    if (invoice.invoiceType !== "pathway_subscription" || !invoice.pathwaySubscriptionId) return;
    const sub = await PathwaySubscriptionModel.findById(invoice.pathwaySubscriptionId);
    if (!sub || sub.status === "cancelled") return;
    const periodEnd = invoice.periodEnd ? String(invoice.periodEnd instanceof Date ? invoice.periodEnd.toISOString() : invoice.periodEnd).slice(0, 10) : null;
    const accessUntil = [sub.accessUntil, periodEnd].filter(Boolean).sort().pop() || null;
    const first = sub.status === "pending";
    const updated = await PathwaySubscriptionModel.update(sub.id, {
      accessUntil, status: "active", pausedAt: null, ...(first ? { startDate: kenyaToday() } : {}),
    });
    await syncAccess(updated);
    if (first) {
      // The sign-up's enquiries (one per child) are marked paid, as the other sign-ups' are.
      await db("leads").where({ invoiceId: invoice.id }).whereNull("paidAt")
        .update({ paidAt: new Date(), paidAmount: money(invoice.amountPaid), paidCurrency: invoice.currency || CURRENCY, paidByUserId: paidByUserId || null, updatedAt: new Date() })
        .catch(() => {});
      const parentId = await parentUserIdOf(updated);
      if (parentId) {
        await NotificationService.notifyPerson(parentId, {
          type: "account_activated",
          title: `${updated.pathwayName} is open`,
          message: `Your payment for ${invoice.invoiceNumber} has been recorded — your ${updated.childCount === 1 ? "child's" : "children's"} ${updated.pathwayName} courses are open until ${periodEnd || "the end of the period"}. It renews automatically.`,
          payload: { invoiceId: invoice.id, route: "/parent" },
          dedupeKey: `pathway_subscription_on:${updated.id}`,
        }).catch(() => {});
      }
      if (!paidByUserId) {
        await NotificationService._notify(updated.ownerAdminId, {
          type: "bootcamp_enrollment_paid",
          title: "Pathway subscription paid",
          message: `${updated.guardianName} paid ${invoice.invoiceNumber} for ${updated.pathwayName} — their courses are open. A hub class is optional.`,
          payload: { route: `/pathway-subscriptions?subscription=${updated.id}` },
          dedupeKey: `pathway_subscription_paid:${updated.id}`,
          ownerAdminId: updated.ownerAdminId,
        }).catch(() => {});
      }
    }
  },

  // Hourly (npm run billing:process): subscriptions whose access has run out with a period still
  // unpaid past the grace days are paused (that invoice cancelled, the family told), and sign-ups
  // never paid within RELEASE_DAYS are cancelled.
  async processLapses({ today = kenyaToday() } = {}) {
    const counts = { paused: 0, released: 0 };
    for (const sub of await db("pathway_subscriptions").where({ status: "active" })) {
      try {
        const grace = await graceDaysFor(sub.ownerAdminId);
        const open = await db("billing_invoices").where({ pathwaySubscriptionId: sub.id }).whereIn("status", OPEN).orderBy("issuedAt", "asc").first();
        if (!open) continue;
        const accessEnd = sub.accessUntil ? addDays(sub.accessUntil, grace) : null;
        const issuedOn = kenyaToday(new Date(open.issuedAt));
        // Still covered, or the unpaid invoice is younger than the grace days (a fresh renewal).
        if ((accessEnd && accessEnd >= today) || addDays(issuedOn, grace) >= today) continue;
        const updated = await PathwaySubscriptionModel.update(sub.id, { status: "paused", pausedAt: new Date() });
        await cancelUnpaidInvoices(updated, null, `Not paid within ${grace} days`);
        counts.paused += 1;
        const parentId = await parentUserIdOf(updated);
        if (parentId) {
          await NotificationService.notifyPerson(parentId, {
            type: "payment_reminder",
            title: `${updated.pathwayName} is paused`,
            message: `${open.invoiceNumber} wasn't paid, so ${updated.pathwayName} is paused and its courses are locked. Your children's progress is kept — renew any time to carry on.`,
            payload: { route: "/parent" },
            dedupeKey: `pathway_subscription_paused:${updated.id}:${today}`,
          }).catch(() => {});
        }
      } catch (err) {
        console.error(`[pathway-subscriptions] could not check ${sub.id}:`, err.message);
      }
    }
    const cutoff = new Date(Date.now() - RELEASE_DAYS * 24 * 3600 * 1000);
    for (const sub of await db("pathway_subscriptions").where({ status: "pending" }).where("createdAt", "<", cutoff)) {
      try {
        const paid = await db("billing_invoices").where({ pathwaySubscriptionId: sub.id }).where("amountPaid", ">", 0).first();
        if (paid) continue;
        const updated = await PathwaySubscriptionModel.update(sub.id, { status: "cancelled", cancelledAt: new Date() });
        await cancelUnpaidInvoices(updated, null, `Sign-up not paid within ${RELEASE_DAYS} days`);
        counts.released += 1;
      } catch (err) {
        console.error(`[pathway-subscriptions] could not release ${sub.id}:`, err.message);
      }
    }
    return counts;
  },
};

// A subscription's invoices with nothing paid on them are cancelled — nobody owes for a period
// they had no access in. A part-paid one is left for staff.
async function cancelUnpaidInvoices(sub, actorUserId, reason) {
  const rows = await db("billing_invoices").where({ pathwaySubscriptionId: sub.id }).whereIn("status", ["issued", "overdue"]).where("amountPaid", "<=", 0);
  for (const inv of rows) {
    await BillingModel.transaction(async (trx) => {
      await BillingModel.updateInvoice(inv.id, { status: "cancelled" }, trx);
      await BillingModel.createAuditEvent({ invoiceId: inv.id, actorUserId, eventType: "invoice_cancelled", previousStatus: inv.status, newStatus: "cancelled", metadata: { reason } }, trx);
    });
  }
}

module.exports = PathwaySubscriptionService;
module.exports.periodLabel = periodLabel;
