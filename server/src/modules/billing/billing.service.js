const db = require("../../config/db");
const BillingModel = require("./billing.model");
const LearningHubService = require("../learning-hubs/learning-hub.service");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const UserModel = require("../auth/user.model");
const NotificationService = require("../notifications/notification.service");
const ClassModel = require("../classes/class.model");
const { sendInvoiceEmail, sendPaymentReceiptEmail } = require("./billing.emails");
const { runInvoiceActivationHooks, runInvoicePaidHooks } = require("./billing.paid-hooks");
const { paymentPosition, scheduleFromPlan, scheduleProblems } = require("./billing.instalments");
const BillingAccess = require("./billing.access");
const { todayInKenya } = require("../checkins/checkin.dates");
const { allowsPlans } = require("../../shared/utils/billing-periods");
const { paymentInstructions } = require("../payments/mpesa/mpesa.instructions");

const RECEIVABLE_STATUSES = ["issued", "partially_paid", "paid", "overdue"];
const PAYABLE_STATUSES = ["issued", "partially_paid", "overdue"];

function money(value) { return Number(Number(value || 0).toFixed(2)); }
function notFound(message) { const err = new Error(message); err.statusCode = 404; return err; }
function badRequest(message) { const err = new Error(message); err.statusCode = 400; return err; }
function forbidden(message) { const err = new Error(message); err.statusCode = 403; return err; }
// A draft is never shown to the payer and is freely edited/cancelled — reserving a real
// sequential number for every abandoned draft would leave gaps that read as "a missing/deleted
// invoice" to anyone auditing the sequence. Drafts get this placeholder instead; issueInvoice
// assigns the real INV-YYYY-000001 number at the moment it becomes a real document. 38 chars,
// fits the column's 40-char limit.
// The workspace's part-payment rules for an invoice (payment-options.js's partPayments). Required
// when needed: payment-options requires the M-Pesa modules, which require this one.
async function partPaymentsOf(invoice) {
  const { invoiceOwnerId } = require("../payments/mpesa/mpesa.instructions");
  return require("../payments/payment-options").partPaymentsFor(await invoiceOwnerId(invoice));
}

function draftInvoiceNumber() { return `DRAFT-${BillingModel.generateId().replace(/-/g, "")}`; }
async function nextInvoiceNumber(trx) { const year = new Date().getFullYear(); return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`; }
async function nextReceiptNumber(trx) { const year = new Date().getFullYear(); return `RCT-${year}-${String(await BillingModel.nextNumber("receipt", year, trx)).padStart(6, "0")}`; }

// The "Bill To" identity for a document — switches on which id is actually set on the invoice,
// not on issuerType, since a school-issued invoice could in principle carry either. Prefers the
// Learner's guardian fields over the User row when both are available: Learner has guardianPhone,
// the payerUserId's own `users` row only has name/email.
async function resolvePayerIdentity(invoice) {
  // A Home Learning package invoice is billed to the household's guardian, with the home address.
  if (invoice.householdId) {
    const household = await db("home_learning_households").where({ id: invoice.householdId }).first();
    if (household) {
      const address = [household.addressLine, household.landmark, household.town, household.subCounty, household.county].filter(Boolean).join(", ") || null;
      return { name: household.guardianName, email: household.guardianEmail || null, phone: household.guardianPhone || null, address };
    }
  }
  // A Tech Club membership invoice is billed to the membership's parent.
  if (invoice.clubMembershipId) {
    const membership = await db("club_memberships").where({ id: invoice.clubMembershipId }).first();
    if (membership) return { name: membership.guardianName, email: membership.guardianEmail || null, phone: membership.guardianPhone || null, address: null };
  }
  // A website Store order is billed to whoever placed it (a guest has no login to look up).
  if (invoice.invoiceType === "store_order") {
    const order = await db("orders").where({ invoiceId: invoice.id }).first();
    if (order) {
      const address = order.fulfilment === "delivery" ? [order.deliveryAddress, order.deliveryTown, order.deliveryCounty].filter(Boolean).join(", ") : null;
      return { name: order.customerName, email: order.customerEmail, phone: order.customerPhone, address };
    }
  }
  if (invoice.payerHubId) {
    const hub = await LearningHubService.getLearningHubById(invoice.payerHubId).catch(() => null);
    if (!hub) return null;
    return { name: hub.name, email: hub.email || null, phone: hub.phone || null, address: hub.address || null };
  }
  if (invoice.payerUserId) {
    if (invoice.learnerId) {
      const learner = await LearnerModel.findById(invoice.learnerId);
      if (learner) return { name: learner.guardianName || null, email: learner.guardianEmail || null, phone: learner.guardianPhone || null, address: null };
    }
    const payer = await UserModel.findById(invoice.payerUserId);
    if (payer) return { name: payer.name || null, email: payer.email || null, phone: null, address: null };
  }
  // A bootcamp enrolment's invoice is raised at sign-up, before the family has a parent login —
  // it bills the parent named on the learner's profile.
  if (invoice.invoiceType === "bootcamp" && invoice.learnerId) {
    const learner = await LearnerModel.findById(invoice.learnerId);
    if (learner?.guardianName || learner?.guardianEmail) return { name: learner.guardianName || null, email: learner.guardianEmail || null, phone: learner.guardianPhone || null, address: null };
  }
  return null;
}

// The families (B2C customers) behind a set of person-billed invoices, one per email the invoices
// bill (else the parent login, phone or name) — so a parent's website sign-up, packages and hub
// visits add up to one customer whether or not each invoice carries their login.
async function familyCustomers(invoices) {
  const paidByInvoice = new Map();
  const payments = (await BillingModel.findPaymentsByInvoiceIds(invoices.map((inv) => inv.id))).filter((p) => p.status === "successful");
  for (const p of payments) paidByInvoice.set(p.invoiceId, money((paidByInvoice.get(p.invoiceId) || 0) + Number(p.amount)));
  const byKey = new Map();
  for (const inv of invoices) {
    const who = (await resolvePayerIdentity(inv).catch(() => null)) || {};
    const email = (who.email || "").trim().toLowerCase();
    const key = email ? `email:${email}` : inv.payerUserId ? `user:${inv.payerUserId}` : who.phone ? `phone:${who.phone}` : who.name ? `name:${who.name.trim().toLowerCase()}` : `invoice:${inv.id}`;
    const customer = byKey.get(key) || { id: key, kind: "b2c", name: who.name || "Unnamed customer", email: who.email || null, phone: who.phone || null, payerUserId: inv.payerUserId || null, invoiceTypes: new Set(), invoiceCount: 0, totalInvoiced: 0, totalPaid: 0, lastInvoiceAt: null };
    customer.invoiceTypes.add(inv.invoiceType);
    customer.invoiceCount += 1;
    customer.totalInvoiced = money(customer.totalInvoiced + Number(inv.total));
    customer.totalPaid = money(customer.totalPaid + (paidByInvoice.get(inv.id) || 0));
    if (inv.issuedAt && (!customer.lastInvoiceAt || String(inv.issuedAt) > String(customer.lastInvoiceAt))) customer.lastInvoiceAt = inv.issuedAt;
    if (!customer.payerUserId && inv.payerUserId) customer.payerUserId = inv.payerUserId;
    byKey.set(key, customer);
  }
  return [...byKey.values()]
    .map((c) => ({ ...c, invoiceTypes: [...c.invoiceTypes], balance: money(c.totalInvoiced - c.totalPaid) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Platform issuer identity for documents Digifunzi itself issues (hub-subscription invoices).
// Static rather than env-driven — matches the "use existing data only" scope; a configurable
// billing-profile can replace this later without changing any consumer.
const PLATFORM_ISSUER = { name: "Digifunzi", email: "billing@digifunzi.com", phone: null, address: null, logo: null };

// The "Issued by" block for a document — the party the payer owes / paid. A hub-issued invoice
// (school billing a guardian) is issued by that hub, with its own logo; a platform invoice
// (Digifunzi billing a hub) is issued by Digifunzi. Purely additive to the payload — every
// existing consumer that ignores `issuedBy` is unaffected.
async function resolveIssuerIdentity(invoice) {
  if (invoice.issuerType === "learning_hub" && invoice.issuerHubId) {
    const hub = await LearningHubService.getLearningHubById(invoice.issuerHubId).catch(() => null);
    if (hub) return { name: hub.name, email: hub.email || null, phone: hub.phone || null, address: hub.address || null, logo: hub.photo || null };
  }
  return PLATFORM_ISSUER;
}

// The learner a document concerns, when it targets one (tuition/materials invoices, and their
// receipts). Just the display trio — name + photo — for the document header. Null for a
// hub-subscription invoice, which has no learnerId.
async function resolveDocumentLearner(learnerId) {
  if (!learnerId) return null;
  const learner = await LearnerModel.findById(learnerId);
  if (!learner) return null;
  return { id: learner.id, firstName: learner.firstName, lastName: learner.lastName, photo: learner.photo || null };
}

// Where an invoice came from, in plain words, with a pointer to the thing that made it. Worked out
// from what's already recorded — the invoice's own ids and its lines' metadata (a hub visit's id,
// a household's id, a bootcamp's id) — so nothing extra is stored and old invoices get it too.
// `ref` is { type, id } for the client to turn into a link in the viewer's own portal.
function itemMeta(item) {
  const m = item?.metadata;
  if (!m) return {};
  if (typeof m === "string") { try { return JSON.parse(m) || {}; } catch { return {}; } }
  return m;
}
// `cache` (one per list request) keeps a long list from looking the same hub or learner up again
// for every invoice.
async function resolveSource(invoice, items, cache = { hubs: new Map(), learners: new Map() }) {
  const remember = (map, id, load) => {
    if (!map.has(id)) map.set(id, load());
    return map.get(id);
  };
  const hubName = (id) => (id ? remember(cache.hubs, id, async () => (await LearningHubService.getLearningHubById(id).catch(() => null))?.name || null) : null);
  const learnerName = (id) => (id ? remember(cache.learners, id, async () => {
    const learner = await LearnerModel.findById(id);
    return learner ? `${learner.firstName || ""} ${learner.lastName || ""}`.trim() || null : null;
  }) : null);
  const metas = items.map(itemMeta);
  const school = await hubName(invoice.hubId || invoice.payerHubId);
  const join = (parts) => parts.filter(Boolean).join(" · ");
  switch (invoice.invoiceType) {
    case "bootcamp": {
      const bootcampId = metas.find((m) => m.bootcampId)?.bootcampId;
      const bootcamp = bootcampId ? await db("bootcamps").where({ id: bootcampId }).first() : null;
      return { kind: "bootcamp", automatic: true, hubName: school, from: join([bootcamp?.name || "Bootcamp", await learnerName(invoice.learnerId)]), ref: bootcamp ? { type: "bootcamp", id: bootcamp.id } : null };
    }
    case "home_learning": {
      const household = invoice.householdId ? await db("home_learning_households").where({ id: invoice.householdId }).first() : null;
      // The period reads "Home Learning · October 2026"; the tab already says Home Learning.
      const month = String(invoice.periodLabel || "").replace(/^Home Learning\s*·\s*/i, "") || null;
      return { kind: "home_learning", automatic: true, hubName: school, from: join([household ? `${household.guardianName} household` : "Home Learning household", month]), ref: household ? { type: "household", id: household.id } : null };
    }
    case "tech_club": {
      const membership = invoice.clubMembershipId ? await db("club_memberships").where({ id: invoice.clubMembershipId }).first() : null;
      const month = String(invoice.periodLabel || "").replace(/^Tech Club\s*·\s*/i, "") || null;
      return { kind: "tech_club", automatic: true, hubName: school, from: join([school, membership ? `${membership.guardianName} family` : "Club membership", month]), ref: membership ? { type: "club_membership", id: membership.id } : null };
    }
    case "hub_usage": {
      const visits = metas.filter((m) => m.hubVisitId).length;
      return { kind: "hub_usage", automatic: true, hubName: school, from: join([school, await learnerName(invoice.learnerId), visits ? `${visits} ${visits === 1 ? "visit" : "visits"}` : null, invoice.periodLabel]), ref: invoice.hubId ? { type: "hub", id: invoice.hubId } : null };
    }
    case "hub_subscription": {
      const hubId = invoice.payerHubId || invoice.hubId;
      return { kind: "hub_subscription", automatic: false, hubName: school, from: join([await hubName(hubId), invoice.periodLabel]), ref: hubId ? { type: "customer", id: hubId } : null };
    }
    default: // learner_term, course_module — made by hand, singly or in a bulk run
      return { kind: invoice.invoiceType, automatic: false, hubName: school, from: join([await learnerName(invoice.learnerId), invoice.periodLabel, invoice.batchId ? "bulk run" : null]), ref: invoice.learnerId ? { type: "learner", id: invoice.learnerId } : null };
  }
}

// Who the customer is: B2B when an organisation (a learning hub/school) is billed, B2C when a
// person is (a parent, household or website buyer). Worked out from the payer, so it never
// drifts from the invoice itself.
const customerKindOf = (invoice) => (invoice.payerHubId ? "b2b" : "b2c");

async function decorate(invoice, items, payments, cache) {
  const amountPaid = money(payments.filter((p) => p.status === "successful").reduce((sum, p) => sum + Number(p.amount), 0));
  // Part payments: the schedule with each part's state, the next part to pay, what's overdue
  // (billing.instalments.js). Nothing is owed on a paid, cancelled or draft invoice.
  const owing = PAYABLE_STATUSES.includes(invoice.status) && Number(invoice.total) - amountPaid > 0;
  const position = paymentPosition(invoice, await BillingModel.findInstalments(invoice.id), amountPaid);
  return {
    ...invoice,
    customerKind: customerKindOf(invoice),
    subtotal: money(invoice.subtotal), discount: money(invoice.discount), total: money(invoice.total),
    amountPaid, amountDue: money(Number(invoice.total) - amountPaid),
    items, payments,
    instalments: position.hasSchedule ? position.parts : [],
    paymentPlan: {
      key: invoice.paymentPlanKey || null,
      next: owing ? position.next : null,
      overdueAmount: owing ? position.overdueAmount : 0,
      overdueSince: owing ? position.overdueSince : null,
      daysOverdue: owing ? position.daysOverdue : 0,
    },
    // "Pay via M-Pesa: Paybill …, Account …" while something is still owed (null when M-Pesa is off).
    payBy: PAYABLE_STATUSES.includes(invoice.status) && Number(invoice.total) - amountPaid > 0 ? await paymentInstructions(invoice).catch(() => null) : null,
    billTo: await resolvePayerIdentity(invoice),
    issuedBy: await resolveIssuerIdentity(invoice),
    learner: await resolveDocumentLearner(invoice.learnerId),
    // Never lets a lookup that fails stop the invoice itself from loading.
    source: await resolveSource(invoice, items, cache).catch(() => null),
    auditEvents: await BillingModel.findAuditEvents(invoice.id),
  };
}

async function assertLearnerAtHub(learnerId, hubId) {
  const learner = await LearnerModel.findById(learnerId);
  if (!learner) throw notFound("Learner not found");
  const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
  if (!links.some((link) => link.hubId === hubId)) throw badRequest("Learner is not enrolled at this learning hub");
  return learner;
}

async function guardianHouseholdIds(req) {
  if (req.user.role !== "learner" || req.user.username || !req.user.email) return [];
  return (await db("home_learning_households").whereRaw("LOWER(guardianEmail) = ?", [req.user.email.toLowerCase()]).select("id")).map((h) => h.id);
}

// Same for a parent's Tech Club memberships (matched on the email they signed up with).
async function guardianClubMembershipIds(req) {
  if (req.user.role !== "learner" || req.user.username || !req.user.email) return [];
  return (await db("club_memberships").whereRaw("LOWER(guardianEmail) = ?", [req.user.email.toLowerCase()]).select("id")).map((m) => m.id);
}

// A parent login's household and club-membership invoices, added to the ones found by learner.
// A parent's own invoices: every one of their children's (req.ownLearners), plus their Home
// Learning household's and Tech Club memberships' (withGuardianInvoices below).
async function familyInvoices(req) {
  const childIds = (req.ownLearners || []).map((l) => l.id);
  const own = childIds.length ? await db("billing_invoices").whereIn("learnerId", childIds).orderBy("createdAt", "desc") : [];
  return withGuardianInvoices(req, own);
}

async function withGuardianInvoices(req, invoices) {
  const [householdIds, membershipIds] = await Promise.all([guardianHouseholdIds(req), guardianClubMembershipIds(req)]);
  const seen = new Set(invoices.map((inv) => inv.id));
  let all = invoices;
  if (householdIds.length) {
    const householdInvoices = await db("billing_invoices").whereIn("householdId", householdIds).orderBy("createdAt", "desc");
    all = all.concat(householdInvoices.filter((inv) => !seen.has(inv.id)));
    householdInvoices.forEach((inv) => seen.add(inv.id));
  }
  if (membershipIds.length) {
    const clubInvoices = await db("billing_invoices").whereIn("clubMembershipId", membershipIds).orderBy("createdAt", "desc");
    all = all.concat(clubInvoices.filter((inv) => !seen.has(inv.id)));
  }
  return all;
}

async function assertAccess(req, invoice) {
  if (req.user.role === "admin") {
    // hubId inherits ownerAdminId transitively through the hub it belongs to — billing_invoices
    // has no owner column of its own (see the migration's comment on why only learning_hubs/
    // curricula/courses/assessments got one). issuerHubId/payerHubId (platform-vs-hub and
    // hub-vs-hub billing flows) are deliberately left unchecked here — only the primary hubId
    // (which hub this invoice is actually about) gates tenant access.
    const hub = await LearningHubService.getLearningHubById(invoice.hubId);
    if (hub.ownerAdminId !== req.ownerAdminId) throw forbidden("You do not have access to this invoice");
    return;
  }
  if (req.user.role === "school") {
    if (invoice.hubId !== req.ownSchool?.id) throw Object.assign(new Error("You do not have access to this invoice"), { statusCode: 403 });
    return;
  }
  if (req.user.role === "learner" && req.user.username) throw forbidden("Learner accounts cannot access invoices");
  if (req.user.role === "learner" && (req.ownLearners || []).some((l) => l.id === invoice.learnerId)) return;
  // A guardian login sees its own Home Learning household's package invoices (matched on the
  // guardian email the household was registered with).
  if (req.user.role === "learner" && invoice.householdId && (await guardianHouseholdIds(req)).includes(invoice.householdId)) return;
  // …and its own Tech Club membership invoices.
  if (req.user.role === "learner" && invoice.clubMembershipId && (await guardianClubMembershipIds(req)).includes(invoice.clubMembershipId)) return;
  throw Object.assign(new Error("You do not have access to this invoice"), { statusCode: 403 });
}

// What a payment switches on (billing.paid-hooks.js): a sign-up, once enough is paid (any payment
// unless the workspace asks for a share); a Store order and closing "I've paid" notices, once it's
// paid in full; and a family paused for being late, once nothing is overdue (billing.access.js).
async function afterPayment(full, { previousStatus = null, amount = null, paidByUserId = null } = {}) {
  const settings = await partPaymentsOf(full).catch(() => ({ minimumPercent: 0 }));
  const share = Number(full.total) > 0 ? (Number(full.amountPaid) / Number(full.total)) * 100 : 100;
  if (Number(full.amountPaid) > 0 && (full.status === "paid" || share >= Number(settings.minimumPercent || 0))) {
    await runInvoiceActivationHooks(full, { amount, paidByUserId });
  }
  if (full.status === "paid" && previousStatus !== "paid") await runInvoicePaidHooks(full);
  if (!full.paymentPlan?.overdueAmount) await BillingAccess.resumeForInvoice(full).catch((err) => console.error("[billing] could not switch a family back on:", err.message));
}

// After a schedule changes: the invoice's status follows (overdue or not), and a family paused for
// being late is switched back on once nothing is.
async function settleAfterScheduleChange(invoiceId) {
  const invoice = await BillingModel.findInvoiceById(invoiceId);
  const full = await decorate(invoice, await BillingModel.findItems(invoiceId), await BillingModel.findPayments(invoiceId));
  if (PAYABLE_STATUSES.includes(invoice.status)) {
    const want = full.paymentPlan.overdueAmount > 0 ? "overdue" : full.amountPaid > 0 ? "partially_paid" : "issued";
    if (want !== invoice.status) await BillingModel.updateInvoice(invoiceId, { status: want });
  }
  if (!full.paymentPlan.overdueAmount) await BillingAccess.resumeForInvoice(full).catch(() => {});
  return decorate(await BillingModel.findInvoiceById(invoiceId), full.items, full.payments);
}

// The plans a family may choose for this invoice when paying it online (a sign-up's Payment step,
// a payment link): only before anything is paid, for the invoice types the workspace allows, each
// with its parts worked out from today. Empty when part payments are off, and for a package's
// invoice covering less than about a quarter (billing-periods.js's allowsPlans).
async function offeredPlans(invoice) {
  if (!invoice || !["issued", "overdue"].includes(invoice.status) || Number(invoice.amountPaid || 0) > 0) return [];
  if (!allowsPlans(invoice)) return [];
  const settings = await partPaymentsOf(invoice);
  if (!settings?.enabled || !(settings.planTypes || []).includes(invoice.invoiceType)) return [];
  const start = todayInKenya();
  return (settings.plans || [])
    .map((plan) => ({ key: plan.key, label: plan.label, parts: scheduleFromPlan(invoice.total, plan, start) }))
    .filter((plan) => plan.parts);
}

const BillingService = {
  offeredPlans,
  afterPayment,

  // Staff setting an invoice's payment schedule: one of the workspace's plans (`planKey`, parts
  // worked out from `startDate`, default today), parts typed by hand (`instalments`), or neither
  // to remove it. Payments already made count towards the first parts.
  async setInstalments(id, data, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    if (req.user.role !== "admin" && !(req.user.role === "school" && invoice.issuerHubId === req.ownSchool?.id)) throw forbidden("You do not have permission to change this invoice's payments");
    await assertAccess(req, invoice);
    if (!["draft", "issued", "partially_paid", "overdue"].includes(invoice.status)) throw badRequest("A paid or cancelled invoice's payment schedule can't change");
    let rows = [];
    let planKey = null;
    if (data.instalments?.length) {
      const problems = scheduleProblems(data.instalments, invoice.total);
      if (problems.length) throw Object.assign(badRequest(problems[0]), { errors: problems.map((message) => ({ message })) });
      rows = data.instalments;
      planKey = data.planKey || "custom";
    } else if (data.planKey) {
      const plan = ((await partPaymentsOf(invoice)).plans || []).find((p) => p.key === data.planKey);
      if (!plan) throw badRequest("That plan isn't one of this workspace's — see Settings → Payments → Part payments");
      rows = scheduleFromPlan(invoice.total, plan, data.startDate || todayInKenya());
      if (!rows) throw badRequest("This invoice is too small to split that way");
      planKey = plan.key;
    }
    await BillingModel.transaction(async (trx) => {
      await BillingModel.replaceInstalments(id, rows, trx);
      await BillingModel.updateInvoice(id, { paymentPlanKey: planKey }, trx);
      await BillingModel.createAuditEvent({ invoiceId: id, actorUserId: req.user.id, eventType: rows.length ? "schedule_set" : "schedule_removed", amount: invoice.total, metadata: { planKey, parts: rows.length } }, trx);
    });
    return settleAfterScheduleChange(id);
  },

  // A family choosing how to pay a sign-up's invoice online (a payment link — no sign-in): one of
  // the plans offered, or null for the whole amount at once. Only before anything is paid.
  async choosePlanForFamily(invoiceId, planKey) {
    const invoice = await BillingModel.findInvoiceById(invoiceId);
    if (!invoice) throw notFound("Invoice not found");
    let rows = [];
    if (planKey) {
      const plan = (await offeredPlans(invoice)).find((p) => p.key === planKey);
      if (!plan) throw badRequest("That payment plan isn't available for this invoice any more");
      rows = plan.parts;
    } else if (Number(invoice.amountPaid || 0) > 0) {
      throw badRequest("A payment has already been made — the plan can't change now");
    }
    await BillingModel.transaction(async (trx) => {
      await BillingModel.replaceInstalments(invoiceId, rows, trx);
      await BillingModel.updateInvoice(invoiceId, { paymentPlanKey: planKey || null }, trx);
      await BillingModel.createAuditEvent({ invoiceId, eventType: rows.length ? "schedule_set" : "schedule_removed", amount: invoice.total, metadata: { planKey: planKey || null, parts: rows.length, by: "family" } }, trx);
    });
    return settleAfterScheduleChange(invoiceId);
  },

  async resolveBulkLearners(data, req) {
    if (req.user.role === "school" && data.hubId !== req.ownSchool?.id) throw forbidden("You can only invoice your own learning hub");
    if (req.user.role === "admin") {
      const hub = await LearningHubService.getLearningHubById(data.hubId);
      if (hub.ownerAdminId !== req.ownerAdminId) throw forbidden("You can only invoice your own learning hub");
    }
    await LearningHubService.getLearningHubById(data.hubId);
    let links;
    if (data.scopeType === "class") {
      if (!data.classId) throw badRequest("A class is required for class invoicing");
      links = (await LearnerHubLinkModel.findByClassId(data.classId)).filter((link) => link.hubId === data.hubId);
    } else if (data.scopeType === "learners") {
      if (!data.learnerIds?.length) throw badRequest("Select at least one learner");
      const allowed = new Set((await LearnerHubLinkModel.findByHubId(data.hubId)).map((link) => link.learnerId));
      links = data.learnerIds.filter((id) => allowed.has(id)).map((learnerId) => ({ learnerId, hubId: data.hubId, status: "active" }));
    } else {
      links = await LearnerHubLinkModel.findByHubId(data.hubId);
    }
    const uniqueLinks = [...new Map(links.map((link) => [link.learnerId, link])).values()];
    const rows = [];
    for (const link of uniqueLinks) {
      const learner = await LearnerModel.findById(link.learnerId);
      if (!learner) { rows.push({ learnerId: link.learnerId, status: "skipped", reason: "Learner record not found" }); continue; }
      if (link.status !== "active") { rows.push({ learnerId: learner.id, learner, status: "skipped", reason: "Enrollment is not active" }); continue; }
      if ((learner.accountStatus || "active") !== "active") { rows.push({ learnerId: learner.id, learner, status: "skipped", reason: "Learner account is inactive" }); continue; }
      if (!learner.guardianEmail) { rows.push({ learnerId: learner.id, learner, status: "skipped", reason: "Learner has no guardian email" }); continue; }
      const payer = await UserModel.findByEmail(learner.guardianEmail);
      if (!payer) { rows.push({ learnerId: learner.id, learner, status: "skipped", reason: "Parent account not found" }); continue; }
      const duplicate = await BillingModel.findExistingLearnerInvoice({ hubId: data.hubId, learnerId: learner.id, invoiceType: data.invoiceType, periodLabel: data.periodLabel });
      rows.push({ learnerId: learner.id, learner, payerUserId: payer.id, status: duplicate ? "skipped" : "eligible", reason: duplicate ? `Already invoiced (${duplicate.invoiceNumber})` : null, existingInvoiceId: duplicate?.id || null });
    }
    return rows;
  },

  async previewBulkInvoices(data, req) {
    const rows = await this.resolveBulkLearners(data, req);
    return { scopeType: data.scopeType, hubId: data.hubId, invoiceType: data.invoiceType, periodLabel: data.periodLabel || null, total: rows.length, eligible: rows.filter((row) => row.status === "eligible").length, skipped: rows.filter((row) => row.status === "skipped").length, learners: rows.map((row) => ({ learnerId: row.learnerId, name: row.learner ? `${row.learner.firstName} ${row.learner.lastName}`.trim() : "Unknown learner", status: row.status, reason: row.reason })) };
  },

  async createBulkInvoices(data, req) {
    const rows = await this.resolveBulkLearners(data, req);
    const eligible = rows.filter((row) => row.status === "eligible");
    if (!eligible.length) throw badRequest("No eligible learners found for invoicing");
    const now = new Date();
    const created = [];
    let batch;
    await BillingModel.transaction(async (trx) => {
      batch = await BillingModel.createBatch({ batchNumber: `BATCH-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, hubId: data.hubId, createdBy: req.user.id, scopeType: data.scopeType, classId: data.classId || null, invoiceType: data.invoiceType, status: "processing", periodLabel: data.periodLabel || null, dueAt: data.dueAt || null, unitAmount: data.unitAmount, totalLearners: rows.length, createdInvoices: 0, skippedLearners: rows.length - eligible.length, totalAmount: 0 }, trx);
      for (const row of eligible) {
        const invoice = await BillingModel.createInvoice({ invoiceNumber: await nextInvoiceNumber(trx), batchId: batch.id, issuerType: "learning_hub", issuerHubId: data.hubId, payerUserId: row.payerUserId, payerHubId: null, learnerId: row.learnerId, hubId: data.hubId, invoiceType: data.invoiceType, status: "issued", currency: "KES", subtotal: data.unitAmount, discount: 0, total: data.unitAmount, amountPaid: 0, periodLabel: data.periodLabel || null, issuedAt: now, dueAt: data.dueAt || null, notes: data.notes || null }, trx);
        await BillingModel.createItem({ invoiceId: invoice.id, learnerId: row.learnerId, courseId: null, description: data.description, quantity: 1, unitAmount: data.unitAmount, totalAmount: data.unitAmount, metadata: { batchId: batch.id } }, trx);
        await BillingModel.createAuditEvent({ invoiceId: invoice.id, batchId: batch.id, actorUserId: req.user.id, eventType: "invoice_issued", newStatus: "issued", amount: data.unitAmount, metadata: { source: "bulk_invoice" } }, trx);
        created.push(invoice);
      }
      await BillingModel.updateBatch(batch.id, { status: rows.length === eligible.length ? "completed" : "completed_with_errors", createdInvoices: created.length, totalAmount: money(created.length * data.unitAmount) }, trx);
    });
    await Promise.all(created.map((invoice) => NotificationService.invoiceIssued({ ...invoice, amountDue: invoice.total })));
    created.forEach((invoice) => this.emailIssuedInvoice(invoice.id));
    return { batch: { ...batch, status: rows.length === eligible.length ? "completed" : "completed_with_errors", createdInvoices: created.length, skippedLearners: rows.length - eligible.length, totalAmount: money(created.length * data.unitAmount) }, created: created.length, skipped: rows.filter((row) => row.status === "skipped").map((row) => ({ learnerId: row.learnerId, name: row.learner ? `${row.learner.firstName} ${row.learner.lastName}`.trim() : "Unknown learner", reason: row.reason })) };
  },

  async listBatches(req) {
    if (req.user.role === "school") {
      return BillingModel.findBatches({ hubId: req.ownSchool?.id || "__none__" });
    }
    if (req.user.role === "admin") {
      // A batch has its own hubId but findBatches' filter takes one exact value at a time — an
      // admin can own more than one hub, so fetch per-hub and merge (same shape as
      // listInvoices' own admin branch above).
      const ownHubIds = (await LearningHubService.getAllLearningHubs({ ownerAdminId: req.ownerAdminId, includeDrafts: true })).map((h) => h.id);
      const perHub = await Promise.all(ownHubIds.map((hubId) => BillingModel.findBatches({ hubId })));
      return perHub.flat();
    }
    return BillingModel.findBatches({});
  },

  async createInvoice(data, req) {
    // hub_usage invoices exist only to record a batch of hub-visits charges (see the hub-visits
    // module's generateCharges) — allowing one to be hand-crafted here would let someone bypass
    // the visit-log audit trail (no hub_visits rows behind it, nothing to mark "invoiced").
    if (data.invoiceType === "hub_usage") throw badRequest("hub_usage invoices are generated from visit logs, not created manually");
    // Same for Home Learning package invoices — raised from the Home Learning page, one per
    // household per month, so the household link and duplicate-month guard can't be bypassed.
    if (data.invoiceType === "home_learning") throw badRequest("Home Learning invoices are raised from the Home Learning page");
    if (data.invoiceType === "tech_club") throw badRequest("Tech Club invoices are raised from the Tech Clubs page");
    const hub = await LearningHubService.getLearningHubById(data.hubId);
    let issuerType = "platform";
    let issuerHubId = null;
    let payerHubId = data.payerHubId || null;
    let payerUserId = data.payerUserId || null;
    let calculatedData = data;

    if (req.user.role === "admin" && data.invoiceType === "hub_subscription" && data.pricingMode === "per_learner") {
      const classes = await ClassModel.findAll({ schoolId: data.hubId, status: "active" });
      if (data.classId && !classes.some((cls) => cls.id === data.classId)) throw badRequest("Selected class does not belong to this hub");
      const links = await LearnerHubLinkModel.findByHubId(data.hubId);
      const learnerIds = new Set(links.filter((link) => link.status === "active" && (!data.classId || link.classId === data.classId)).map((link) => link.learnerId));
      const learnerCount = learnerIds.size;
      const classCount = data.classId ? 1 : classes.length;
      if (!learnerCount) throw badRequest("No active learners found for the selected scope");
      const unitAmount = money(data.unitAmount || data.items[0]?.unitAmount);
      if (unitAmount <= 0) throw badRequest("A positive amount per learner is required");
      calculatedData = { ...data, classId: data.classId || null, pricingMode: "per_learner", unitAmount, learnerCount, classCount, items: [{ ...data.items[0], description: data.items[0].description, quantity: learnerCount, unitAmount }] };
    }

    if (req.user.role === "school") {
      if (data.hubId !== req.ownSchool?.id) throw Object.assign(new Error("You can only invoice your own learning hub"), { statusCode: 403 });
      if (data.invoiceType === "hub_subscription") throw badRequest("A learning hub cannot create a hub subscription invoice");
      issuerType = "learning_hub";
      issuerHubId = data.hubId;
      const learner = await assertLearnerAtHub(data.learnerId, data.hubId);
      if (!payerUserId && learner.guardianEmail) payerUserId = (await UserModel.findByEmail(learner.guardianEmail))?.id || null;
    } else {
      if (data.invoiceType !== "hub_subscription") throw badRequest("Admin invoices must be hub subscription invoices");
      // Each admin's billing is its own tenant now — a hub_subscription invoice is this admin
      // billing one of their OWN hubs, never another admin's (there's no cross-tenant "platform
      // bills every hub" relationship anymore).
      if (hub.ownerAdminId !== req.ownerAdminId) throw Object.assign(new Error("You can only invoice your own learning hub"), { statusCode: 403 });
      payerHubId = data.hubId;
    }

    if (data.invoiceType !== "hub_subscription") await assertLearnerAtHub(data.learnerId, data.hubId);
    if (data.invoiceType === "hub_subscription" && data.learnerId) throw badRequest("Hub subscription invoices cannot target a learner");
    if (data.invoiceType !== "hub_subscription" && !data.learnerId) throw badRequest("Learner is required for this invoice type");

    const subtotal = money(calculatedData.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitAmount), 0));
    const discount = money(calculatedData.discount);
    if (discount > subtotal) throw badRequest("Discount cannot exceed the invoice subtotal");
    const total = money(subtotal - discount);
    const invoice = await BillingModel.createInvoice({
      invoiceNumber: draftInvoiceNumber(),
      issuerType, issuerHubId, payerUserId, payerHubId, learnerId: data.learnerId || null, hubId: hub.id,
      invoiceType: calculatedData.invoiceType, status: "draft", currency: "KES", subtotal, discount, total, amountPaid: 0,
      classId: calculatedData.classId || null, pricingMode: calculatedData.pricingMode || "flat", unitAmount: calculatedData.unitAmount || null,
      learnerCount: calculatedData.learnerCount || null, classCount: calculatedData.classCount || null,
      periodStart: calculatedData.periodStart || null, periodEnd: calculatedData.periodEnd || null, periodLabel: calculatedData.periodLabel || null,
      dueAt: calculatedData.dueAt || null, notes: calculatedData.notes || null,
    });
    const items = [];
    for (const item of calculatedData.items) {
      items.push(await BillingModel.createItem({
        invoiceId: invoice.id, learnerId: item.learnerId || data.learnerId || null, courseId: item.courseId || null,
        description: item.description, quantity: item.quantity, unitAmount: money(item.unitAmount),
        totalAmount: money(Number(item.quantity) * Number(item.unitAmount)), metadata: item.metadata || null,
      }));
    }
    await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId: req.user.id, eventType: "invoice_created", newStatus: "draft", amount: total });
    return decorate(invoice, items, []);
  },

  async listInvoices(req) {
    const filters = {};
    if (req.user.role === "school") filters.hubId = req.ownSchool?.id || "__none__";
    if (req.user.role === "learner" && req.user.username) return [];
    let invoices = req.user.role === "learner" ? await familyInvoices(req) : await BillingModel.findInvoices(filters);
    // hubId inherits ownerAdminId transitively — findInvoices' filter object only takes a single
    // exact value per column (no whereIn), and an admin can own more than one hub, so this
    // resolves the admin's own hub ids first and filters in JS, same as learning-hub.model.js's
    // county filter does for a JSON-nested field that SQL can't filter directly.
    if (req.user.role === "admin") {
      const ownHubIds = new Set((await LearningHubService.getAllLearningHubs({ ownerAdminId: req.ownerAdminId, includeDrafts: true })).map((h) => h.id));
      invoices = invoices.filter((invoice) => ownHubIds.has(invoice.hubId));
    }
    const cache = { hubs: new Map(), learners: new Map() };
    return Promise.all(invoices.map(async (invoice) => decorate(invoice, await BillingModel.findItems(invoice.id), await BillingModel.findPayments(invoice.id), cache)));
  },

  async getInvoice(id, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    await assertAccess(req, invoice);
    return decorate(invoice, await BillingModel.findItems(id), await BillingModel.findPayments(id));
  },

  async updateInvoice(id, data, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    if (req.user.role !== "admin" && !(req.user.role === "school" && invoice.issuerHubId === req.ownSchool?.id)) throw Object.assign(new Error("You do not have permission to edit this invoice"), { statusCode: 403 });
    if (invoice.status !== "draft") throw badRequest("Only draft invoices can be edited");
    const items = await BillingModel.findItems(id);
    const patch = { ...data };
    // discount is validated against the subtotal and total is recomputed here — same rule
    // createInvoice enforces at creation time (discount cannot exceed subtotal). Without this,
    // patching discount on a draft invoice would leave `total` stale at its pre-patch value,
    // showing a discount the total never actually reflects.
    if ("discount" in patch) {
      const subtotal = money(items.reduce((sum, item) => sum + Number(item.totalAmount), 0));
      const discount = money(patch.discount);
      if (discount > subtotal) throw badRequest("Discount cannot exceed the invoice subtotal");
      patch.discount = discount;
      patch.total = money(subtotal - discount);
    }
    const updated = await BillingModel.updateInvoice(id, patch);
    return decorate(updated, items, await BillingModel.findPayments(id));
  },

  async issueInvoice(id, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    if (req.user.role !== "admin" && !(req.user.role === "school" && invoice.issuerHubId === req.ownSchool?.id)) throw Object.assign(new Error("You do not have permission to issue this invoice"), { statusCode: 403 });
    if (invoice.status !== "draft") throw badRequest("Only draft invoices can be issued");
    let updated;
    await BillingModel.transaction(async (trx) => {
      updated = await BillingModel.updateInvoice(id, { status: "issued", issuedAt: new Date(), invoiceNumber: await nextInvoiceNumber(trx) }, trx);
      await BillingModel.createAuditEvent({ invoiceId: id, actorUserId: req.user.id, eventType: "invoice_issued", previousStatus: invoice.status, newStatus: "issued", amount: invoice.total }, trx);
    });
    const full = await decorate(updated, await BillingModel.findItems(id), await BillingModel.findPayments(id));
    if (full.payerUserId) await NotificationService.invoiceIssued(full);
    sendInvoiceEmail(full).catch(() => {});
    return full;
  },

  // The full document for an invoice, with no access check — for server-side use only (emails).
  async getInvoiceDocument(id) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) return null;
    return decorate(invoice, await BillingModel.findItems(id), await BillingModel.findPayments(id));
  },

  // Emails a just-issued invoice to whoever it bills. Fire-and-forget, and safe to call from
  // every place that issues one (here, hub visits, Home Learning): it's sent once per invoice,
  // and quietly does nothing if the payer has no email address.
  emailIssuedInvoice(id) {
    this.getInvoiceDocument(id)
      .then((invoice) => invoice && sendInvoiceEmail(invoice))
      .catch((err) => console.error("[billing] could not email invoice:", err.message));
  },

  // Staff pressing "Email invoice" — sends (or re-sends) it now and reports what happened.
  async emailInvoice(id, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    if (req.user.role !== "admin" && !(req.user.role === "school" && invoice.issuerHubId === req.ownSchool?.id)) throw forbidden("You do not have permission to email this invoice");
    await assertAccess(req, invoice);
    if (!RECEIVABLE_STATUSES.includes(invoice.status)) throw badRequest("Only an issued invoice can be emailed");
    const full = await this.getInvoiceDocument(id);
    const sent = await sendInvoiceEmail(full, { manual: true });
    if (!sent) throw badRequest("There is no email address on file for this invoice's payer");
    // 409 rather than a 5xx: the error handler hides 5xx messages in production, and these are
    // exactly what the person pressing the button needs to read.
    if (sent.status === "skipped") throw Object.assign(new Error("Email isn't set up on this server yet"), { statusCode: 409 });
    if (sent.status !== "sent") throw Object.assign(new Error("The email could not be sent right now. It will be retried automatically."), { statusCode: 409 });
    await BillingModel.createAuditEvent({ invoiceId: id, actorUserId: req.user.id, eventType: "invoice_emailed", metadata: { to: full.billTo.email } });
    return { ...(await this.getInvoiceDocument(id)), emailedTo: full.billTo.email };
  },

  async cancelInvoice(id, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    if (req.user.role !== "admin" && !(req.user.role === "school" && invoice.issuerHubId === req.ownSchool?.id)) throw Object.assign(new Error("You do not have permission to cancel this invoice"), { statusCode: 403 });
    if (["paid", "partially_paid", "cancelled"].includes(invoice.status)) throw badRequest("This invoice cannot be cancelled");
    let updated;
    await BillingModel.transaction(async (trx) => {
      updated = await BillingModel.updateInvoice(id, { status: "cancelled" }, trx);
      await BillingModel.createAuditEvent({ invoiceId: id, actorUserId: req.user.id, eventType: "invoice_cancelled", previousStatus: invoice.status, newStatus: "cancelled" }, trx);
    });
    return await decorate(updated, await BillingModel.findItems(id), await BillingModel.findPayments(id));
  },

  // Staff recording money received by hand (cash, a bank transfer, an M-Pesa code typed in).
  async recordPayment(id, data, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    await assertAccess(req, invoice);
    const existingPayment = await BillingModel.findPaymentByIdempotencyKey(data.idempotencyKey);
    if (existingPayment) return decorate(invoice, await BillingModel.findItems(id), await BillingModel.findPayments(id));
    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    if (Number.isNaN(paymentDate.getTime())) throw badRequest("Payment date is invalid");
    const { invoice: full } = await this.applyPayment(id, {
      amount: data.amount, provider: "manual", paymentMethod: data.paymentMethod, providerReference: data.providerReference || null,
      paymentDate, payerUserId: invoice.payerUserId || req.user.id, recordedBy: req.user.id, idempotencyKey: data.idempotencyKey || null,
      notes: data.notes || null,
    });
    return full;
  },

  // Puts money on an invoice: the one place a payment row is written, for staff entries
  // (recordPayment above) and for money that arrived by itself (M-Pesa callbacks, the reconcile
  // job). No `req` and no access check — callers do their own. Locks the invoice row, so two
  // payments at once can't both read the old balance.
  //
  // A hand-typed amount above what's due is refused. Money that has already arrived (allowExcess)
  // can't be refused: it pays what's due and the rest comes back as `excess` for the caller to
  // keep track of. An idempotencyKey seen before returns that earlier payment with
  // `duplicate: true` and changes nothing. When the payment settles the invoice, the "invoice
  // paid" hooks run afterwards (a website sign-up is switched on, and so on).
  async applyPayment(invoiceId, { amount, provider = "manual", paymentMethod, providerReference = null, paymentDate = null, payerUserId = null, recordedBy = null, idempotencyKey = null, notes = null, metadata = null, allowExcess = false }) {
    const paidAt = paymentDate ? new Date(paymentDate) : new Date();
    let payment;
    let updated;
    let previousStatus;
    let duplicate = false;
    let excess = 0;
    await BillingModel.transaction(async (trx) => {
      const lockedInvoice = await BillingModel.findInvoiceById(invoiceId, trx, true);
      if (!lockedInvoice) throw notFound("Invoice not found");
      previousStatus = lockedInvoice.status;
      const retriedPayment = await BillingModel.findPaymentByIdempotencyKey(idempotencyKey, trx);
      if (retriedPayment) {
        payment = retriedPayment;
        updated = lockedInvoice;
        duplicate = true;
        return;
      }
      if (!PAYABLE_STATUSES.includes(lockedInvoice.status)) throw badRequest("This invoice is not payable");
      const currentPaid = money((await BillingModel.sumSuccessfulPayments(invoiceId, trx))?.total);
      const due = money(Number(lockedInvoice.total) - currentPaid);
      let credit = money(amount);
      if (credit > due) {
        if (!allowExcess) throw badRequest("Payment exceeds the amount due");
        excess = money(credit - due);
        credit = due;
      }
      if (credit <= 0) throw badRequest("This invoice has nothing left to pay");
      const newPaid = money(currentPaid + credit);
      // Still owing: "overdue" while a part of the schedule (or the whole invoice, past its due date)
      // is late, otherwise partly paid.
      let newStatus = "paid";
      if (newPaid < money(lockedInvoice.total)) {
        const late = paymentPosition(lockedInvoice, await BillingModel.findInstalments(invoiceId, trx), newPaid).overdueAmount > 0;
        newStatus = late ? "overdue" : "partially_paid";
      }
      payment = await BillingModel.createPayment({ invoiceId, payerUserId: payerUserId || lockedInvoice.payerUserId || null, recordedBy, idempotencyKey, provider, providerReference, receiptNumber: await nextReceiptNumber(trx), amount: credit, currency: lockedInvoice.currency, status: "successful", paymentMethod, paymentDate: paidAt, paidAt, notes, metadata }, trx);
      updated = await BillingModel.updateInvoice(invoiceId, { amountPaid: newPaid, status: newStatus, paidAt: newStatus === "paid" ? new Date() : null }, trx);
      await BillingModel.createAuditEvent({ invoiceId, paymentId: payment.id, batchId: lockedInvoice.batchId || null, actorUserId: recordedBy, eventType: "payment_recorded", previousStatus: lockedInvoice.status, newStatus, amount: credit, metadata: { paymentMethod, provider, receiptNumber: payment.receiptNumber, ...(providerReference ? { providerReference } : {}), ...(excess ? { excess } : {}) } }, trx);
    });
    const full = await decorate(updated, await BillingModel.findItems(invoiceId), await BillingModel.findPayments(invoiceId));
    if (!duplicate) {
      // Sent once per payment (see its dedupeKey), so an idempotent retry is harmless.
      sendPaymentReceiptEmail(full, payment).catch(() => {});
      await afterPayment(full, { previousStatus, amount: money(amount), paidByUserId: recordedBy });
    }
    return { invoice: full, payment, excess, duplicate };
  },

  async getReceipt(invoiceId, paymentId, req) {
    const invoice = await BillingModel.findInvoiceById(invoiceId);
    if (!invoice) throw notFound("Invoice not found");
    await assertAccess(req, invoice);
    const payment = await BillingModel.findPaymentById(paymentId);
    if (!payment || payment.invoiceId !== invoiceId) throw notFound("Receipt not found");
    return {
      ...payment,
      amount: money(payment.amount),
      invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, invoiceType: invoice.invoiceType, currency: invoice.currency, total: money(invoice.total), amountDue: money(Number(invoice.total) - Number(invoice.amountPaid || 0)), status: invoice.status },
      billTo: await resolvePayerIdentity(invoice),
      issuedBy: await resolveIssuerIdentity(invoice),
      learner: await resolveDocumentLearner(invoice.learnerId),
    };
  },

  async listReceipts(req) {
    const filters = {};
    if (req.user.role === "school") filters.hubId = req.ownSchool?.id || "__none__";
    if (req.user.role === "learner" && req.user.username) return [];
    let invoices = req.user.role === "learner" ? await familyInvoices(req) : await BillingModel.findInvoices(filters);
    // Same tenant-boundary reasoning as listInvoices above — hubId inherits ownerAdminId
    // transitively, and an admin can own more than one hub, so filter in JS after the fact.
    if (req.user.role === "admin") {
      const ownHubIds = new Set((await LearningHubService.getAllLearningHubs({ ownerAdminId: req.ownerAdminId, includeDrafts: true })).map((h) => h.id));
      invoices = invoices.filter((invoice) => ownHubIds.has(invoice.hubId));
    }
    const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));
    const payments = (await BillingModel.findPaymentsByInvoiceIds(invoices.map((inv) => inv.id))).filter((p) => p.status === "successful");
    return Promise.all(payments.map(async (payment) => {
      const invoice = invoiceById.get(payment.invoiceId);
      return { ...payment, amount: money(payment.amount), invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber, invoiceType: invoice.invoiceType, currency: invoice.currency, customerKind: customerKindOf(invoice) } : null, billTo: invoice ? await resolvePayerIdentity(invoice) : null };
    }));
  },

  // Statement of Account — a per-payer running ledger, computed on the fly from existing
  // invoices/payments (no new table). Access control is role-driven filtering, not a
  // client-supplied-id check: mirrors listInvoices' `filters.hubId = req.ownSchool?.id` posture
  // rather than trusting the URL's payerId for anyone but admin.
  async getStatement(payerType, rawPayerId, { from, to }, req) {
    if (!["user", "hub"].includes(payerType)) throw badRequest("Invalid statement type");

    let payerId = rawPayerId;
    let hubId;
    if (req.user.role === "learner") {
      if (req.user.username) throw forbidden("Learner accounts cannot access billing statements");
      if (payerType !== "user") throw forbidden("You do not have access to this statement");
      payerId = req.user.id; // payerUserId on a guardian's invoices IS their own users.id — never trust the URL here
    } else if (req.user.role === "school") {
      if (!req.ownSchool) throw forbidden("You do not have access to this statement");
      if (payerType === "hub") {
        if (payerId !== req.ownSchool.id) throw forbidden("You do not have access to this statement");
      } else {
        hubId = req.ownSchool.id; // a school's view of a guardian's statement is always scoped to their own hub, never the guardian's full history
      }
    } else if (req.user.role === "admin") {
      // A hub statement's payerId is directly the hub's own id — must be one of this admin's own
      // hubs.
      if (payerType === "hub") {
        const hub = await LearningHubService.getLearningHubById(payerId).catch(() => null);
        if (!hub || hub.ownerAdminId !== req.ownerAdminId) throw forbidden("You do not have access to this statement");
      }
      // A user (guardian) statement has no hub of its own on the request — its invoices are
      // narrowed to this admin's own hubs below, after fetching (an admin can own more than one
      // hub, so this can't be a single-value hubId filter the way "school" narrows to just its
      // own). Without this, an admin could read any guardian's full cross-tenant payment history
      // by user id.
    } else {
      throw forbidden("You do not have access to this statement");
    }

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getFullYear(), toDate.getMonth() - 12, toDate.getDate());
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) throw badRequest("Invalid date range");

    const filters = payerType === "hub" ? { payerHubId: payerId } : { payerUserId: payerId };
    if (hubId) filters.hubId = hubId;
    let invoices = (await BillingModel.findInvoices(filters)).filter((inv) => RECEIVABLE_STATUSES.includes(inv.status));
    if (req.user.role === "admin" && payerType === "user") {
      const ownHubIds = new Set((await LearningHubService.getAllLearningHubs({ ownerAdminId: req.ownerAdminId, includeDrafts: true })).map((h) => h.id));
      invoices = invoices.filter((inv) => ownHubIds.has(inv.hubId));
    }
    const payments = (await BillingModel.findPaymentsByInvoiceIds(invoices.map((inv) => inv.id))).filter((p) => p.status === "successful");

    // Two independently date-filtered sums, not "payments against invoices dated before from" —
    // that formulation double-counts a payment made after `from` against an invoice issued
    // before it, silently corrupting every running balance after it.
    const openingInvoiced = money(invoices.filter((inv) => inv.issuedAt && new Date(inv.issuedAt) < fromDate).reduce((sum, inv) => sum + Number(inv.total), 0));
    const openingPaid = money(payments.filter((p) => p.paidAt && new Date(p.paidAt) < fromDate).reduce((sum, p) => sum + Number(p.amount), 0));
    const openingBalance = money(openingInvoiced - openingPaid);

    const inRangeInvoices = invoices.filter((inv) => inv.issuedAt && new Date(inv.issuedAt) >= fromDate && new Date(inv.issuedAt) <= toDate);
    const inRangePayments = payments.filter((p) => p.paidAt && new Date(p.paidAt) >= fromDate && new Date(p.paidAt) <= toDate);
    const lines = [
      ...inRangeInvoices.map((inv) => ({ date: inv.issuedAt, type: "invoice", reference: inv.invoiceNumber, description: `${inv.invoiceType.replace(/_/g, " ")}${inv.periodLabel ? ` — ${inv.periodLabel}` : ""}`, debit: money(inv.total), credit: 0 })),
      ...inRangePayments.map((p) => ({ date: p.paidAt, type: "payment", reference: p.receiptNumber, description: p.paymentMethod || p.provider, debit: 0, credit: money(p.amount) })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let running = openingBalance;
    const ledger = lines.map((line) => { running = money(running + line.debit - line.credit); return { ...line, balance: running }; });
    const closingBalance = ledger.length ? ledger[ledger.length - 1].balance : openingBalance;

    const now = new Date();
    const aging = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    for (const inv of invoices) {
      const outstanding = money(Number(inv.total) - Number(inv.amountPaid || 0));
      if (outstanding <= 0) continue;
      const dueAt = inv.dueAt ? new Date(inv.dueAt) : (inv.issuedAt ? new Date(inv.issuedAt) : now);
      const daysPastDue = Math.floor((now - dueAt) / (1000 * 60 * 60 * 24));
      const bucket = daysPastDue <= 0 ? "current" : daysPastDue <= 30 ? "1-30" : daysPastDue <= 60 ? "31-60" : daysPastDue <= 90 ? "61-90" : "90+";
      aging[bucket] = money(aging[bucket] + outstanding);
    }

    const billTo = payerType === "hub"
      ? await resolvePayerIdentity({ payerHubId: payerId })
      : await resolvePayerIdentity({ payerUserId: payerId, learnerId: invoices[0]?.learnerId || null });

    // Issuer for a statement: a hub-payer statement is Digifunzi billing that hub; a user-payer
    // statement is issued by whichever hub billed them (resolved off any invoice in the set —
    // a user statement is already hub-scoped for a school caller, and a guardian only ever has
    // one hub relationship in practice). Falls back to the platform issuer if nothing resolves.
    const issuedBy = payerType === "hub"
      ? PLATFORM_ISSUER
      : await resolveIssuerIdentity(invoices[0] || {});
    const learner = payerType === "user" ? await resolveDocumentLearner(invoices[0]?.learnerId) : null;

    return {
      payerType, payerId, from: fromDate, to: toDate, billTo, issuedBy, learner,
      openingBalance, closingBalance,
      totalInvoiced: money(inRangeInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)),
      totalPaid: money(inRangePayments.reduce((sum, p) => sum + Number(p.amount), 0)),
      ledger, aging,
    };
  },

  // Customers — admin-only, and tenant-scoped like everything else: a "customer" is one of THIS
  // admin's own learning hubs being billed (invoiceType hub_subscription, payerHubId set).
  // Derived on the fly from existing hubs + invoices + payments, no dedicated table. Every hub
  // this admin owns is listed, including ones never invoiced, so the admin can open one and
  // raise its first invoice — never another admin's hubs.
  async listCustomers(req) {
    if (req.user.role !== "admin") throw forbidden("Only the platform administrator can view customers");
    // The Home Learning hub is never a paying customer — its families are billed per household
    // from the Home Learning page — so it's left out of the customer list.
    const allHubs = await LearningHubService.getAllLearningHubs({ ownerAdminId: req.ownerAdminId, includeDrafts: true });
    const hubs = allHubs.filter((h) => !h.isHomeLearning);
    const hubIds = new Set(hubs.map((h) => h.id));
    const ownHubIds = new Set(allHubs.map((h) => h.id));
    const receivable = (await BillingModel.findInvoices({})).filter((inv) => RECEIVABLE_STATUSES.includes(inv.status));
    const invoices = receivable.filter((inv) => inv.payerHubId && hubIds.has(inv.payerHubId));
    const payments = (await BillingModel.findPaymentsByInvoiceIds(invoices.map((inv) => inv.id))).filter((p) => p.status === "successful");
    const paidByInvoice = new Map();
    for (const p of payments) paidByInvoice.set(p.invoiceId, money((paidByInvoice.get(p.invoiceId) || 0) + Number(p.amount)));

    const businesses = hubs.map((hub) => {
      const hubInvoices = invoices.filter((inv) => inv.payerHubId === hub.id);
      const totalInvoiced = money(hubInvoices.reduce((sum, inv) => sum + Number(inv.total), 0));
      const totalPaid = money(hubInvoices.reduce((sum, inv) => sum + (paidByInvoice.get(inv.id) || 0), 0));
      const issuedAts = hubInvoices.map((inv) => inv.issuedAt).filter(Boolean).sort();
      return {
        id: hub.id,
        kind: "b2b",
        name: hub.name,
        email: hub.email || null,
        phone: hub.phone || null,
        type: hub.hubType || null,
        status: hub.status || null,
        invoiceCount: hubInvoices.length,
        totalInvoiced,
        totalPaid,
        balance: money(totalInvoiced - totalPaid),
        lastInvoiceAt: issuedAts.length ? issuedAts[issuedAts.length - 1] : null,
      };
    });
    const families = await familyCustomers(receivable.filter((inv) => !inv.payerHubId && ownHubIds.has(inv.hubId)));
    return [...businesses, ...families];
  },

  async getCustomer(hubId, req) {
    if (req.user.role !== "admin") throw forbidden("Only the platform administrator can view customers");
    const hub = await LearningHubService.getLearningHubById(hubId);
    if (hub.ownerAdminId !== req.ownerAdminId) throw forbidden("You do not have access to this customer");
    const invoices = (await BillingModel.findInvoices({ payerHubId: hubId })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const payments = (await BillingModel.findPaymentsByInvoiceIds(invoices.map((inv) => inv.id))).filter((p) => p.status === "successful");
    const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));
    const paidByInvoice = new Map();
    for (const p of payments) paidByInvoice.set(p.invoiceId, money((paidByInvoice.get(p.invoiceId) || 0) + Number(p.amount)));

    const receivable = invoices.filter((inv) => RECEIVABLE_STATUSES.includes(inv.status));
    const totalInvoiced = money(receivable.reduce((sum, inv) => sum + Number(inv.total), 0));
    const totalPaid = money(receivable.reduce((sum, inv) => sum + (paidByInvoice.get(inv.id) || 0), 0));

    return {
      customer: {
        id: hub.id, name: hub.name, email: hub.email || null, phone: hub.phone || null,
        address: hub.address || null, type: hub.hubType || null, status: hub.status || null,
        logo: hub.photo || null,
      },
      billTo: await resolvePayerIdentity({ payerHubId: hubId }),
      summary: { invoiceCount: invoices.length, totalInvoiced, totalPaid, balance: money(totalInvoiced - totalPaid) },
      invoices: invoices.map((inv) => ({
        id: inv.id, invoiceNumber: inv.invoiceNumber, invoiceType: inv.invoiceType, status: inv.status,
        currency: inv.currency, total: money(inv.total), amountPaid: money(paidByInvoice.get(inv.id) || 0),
        amountDue: money(Number(inv.total) - (paidByInvoice.get(inv.id) || 0)),
        createdAt: inv.createdAt, issuedAt: inv.issuedAt, dueAt: inv.dueAt, periodLabel: inv.periodLabel,
      })),
      payments: payments.map((p) => {
        const inv = invoiceById.get(p.invoiceId);
        return {
          id: p.id, invoiceId: p.invoiceId, receiptNumber: p.receiptNumber, amount: money(p.amount),
          currency: p.currency, paymentMethod: p.paymentMethod, provider: p.provider, paidAt: p.paidAt,
          invoice: inv ? { invoiceNumber: inv.invoiceNumber, currency: inv.currency } : null,
        };
      }),
    };
  },
};

module.exports = BillingService;
// Who an invoice is billed to — also for payments/payment-notices.service.js.
module.exports.resolvePayerIdentity = resolvePayerIdentity;
