const HubVisitModel = require("./hub-visit.model");
const LearningHubService = require("../learning-hubs/learning-hub.service");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const UserModel = require("../auth/user.model");
const BillingModel = require("../billing/billing.model");
const NotificationService = require("../notifications/notification.service");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const CourseModel = require("../courses/course.model");

// KNOWN LIMITATION: payer resolution below reuses billing.service.js's guardian-email path
// unchanged (a learner has no independent contact channel of its own - see learner.model.js).
// An adult learner at a co-working space with no "guardian" has no alternate payer path today;
// fixing that needs a larger change to the learner contact-field shape and is out of scope here.

function money(value) { return Number(Number(value || 0).toFixed(2)); }
function notFound(message) { const err = new Error(message); err.statusCode = 404; return err; }
function badRequest(message) { const err = new Error(message); err.statusCode = 400; return err; }
function forbidden(message) { const err = new Error(message); err.statusCode = 403; return err; }

async function nextInvoiceNumber(trx) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`;
}

async function assertNonSchoolHub(hubId) {
  const hub = await LearningHubService.getLearningHubById(hubId);
  if (hub.hubType === "school") throw badRequest("Visits can only be logged at a non-school hub");
  return hub;
}

// Duplicated locally rather than imported from billing.service.js (which doesn't export it) -
// same call as the deleted mentor-sessions module made for the same reason: a small, stable
// check not worth adding a cross-module export for.
async function assertLearnerAtHub(learnerId, hubId) {
  const learner = await LearnerModel.findById(learnerId);
  if (!learner) throw notFound("Learner not found");
  const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
  if (!link) throw badRequest("Learner is not enrolled at this learning hub");
  return { learner, link };
}

function resolveSpace(hub, spaceId) {
  const space = (hub.spaces || []).find((s) => s.id === spaceId);
  if (!space) throw badRequest("Space not found on this hub");
  return space;
}

// A learner's class/course enrollment (learner_hub_links.classId -> classes ->
// class_course_teacher_links -> courses) is informational context on a hub_usage invoice line,
// not part of what's charged - the space's rate still decides the amount (see computeAmount).
// Returns "" when the learner has no class at this hub (most non-school hub visits - a class
// only exists here when a bootcamp cohort is running at the hub, see bootcamp-hub.service.js's
// cohortClassPayload) so the line item description falls back to just the space name and date.
async function resolveLearnerClassContext(learnerId, hubId) {
  const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
  if (!link?.classId) return "";
  const cls = await ClassModel.findById(link.classId);
  if (!cls) return "";
  const courseLinks = await ClassCourseTeacherLinkModel.findByClassId(link.classId);
  const courseIds = [...new Set(courseLinks.map((l) => l.courseId))];
  const courses = (await Promise.all(courseIds.map((id) => CourseModel.findById(id)))).filter(Boolean);
  const courseNames = courses.map((c) => c.name).join(", ");
  return courseNames ? `${cls.name} (${courseNames})` : cls.name;
}

// A learner's own negotiated rate (learner_hub_links.pricingOverride*) wins over the space's
// list price when set; everything else (pricingModel, priceUnit) always comes from the space.
function resolveEffectiveRate(link, space) {
  return {
    pricingModel: space.pricingModel,
    rate: link?.pricingOverrideRate != null ? Number(link.pricingOverrideRate) : Number(space.rate || 0),
    priceUnit: link?.pricingOverrideUnit || space.priceUnit,
  };
}

function computeAmount({ pricingModel, rate, hours }) {
  if (pricingModel === "free") return 0;
  if (pricingModel === "hourly") return money(rate * Number(hours || 0));
  return money(rate);
}

async function ownHubIds(req) {
  const hubs = await LearningHubService.getAllLearningHubs({ ownerAdminId: req.ownerAdminId, includeDrafts: true });
  return new Set(hubs.map((h) => h.id));
}

// Role-gated the same way billing.service.js's assertAccess is: admin must own the hub, school
// must be viewing its own record. No "learner" case - a learner never manages visits directly,
// only ever sees the resulting invoice through the existing Billing views.
async function assertHubAccess(req, hubId) {
  if (req.user.role === "admin") {
    if (!(await ownHubIds(req)).has(hubId)) throw forbidden("You do not have access to this learning hub");
    return;
  }
  if (req.user.role === "school") {
    if (hubId !== req.ownSchool?.id) throw forbidden("You do not have access to this learning hub");
    return;
  }
  throw forbidden("You do not have access to this learning hub");
}

// Internal helpers backing logVisit's immediate-invoice attempt - not part of the exported
// service surface, just factored out of logVisit for readability.
const HubVisitInternal = {
  // Same guardian-email payer resolution resolveEligibleLearners uses for the batch path, but for
  // one just-logged visit. Returns null (never throws) when no payer can be resolved yet - the
  // visit itself must still be logged and simply stays unbilled, ready to be picked up later by
  // "Generate charges" once the learner's guardian info is fixed.
  async resolvePayerForLearner(learnerId) {
    const learner = await LearnerModel.findById(learnerId);
    if (!learner?.guardianEmail) return null;
    const payer = await UserModel.findByEmail(learner.guardianEmail);
    return payer ? { learner, payerUserId: payer.id } : null;
  },

  // Bills a single freshly-logged visit immediately: one hub_usage invoice, one line item, issued
  // on the spot - the "every visit gets invoiced as it happens" counterpart to generateCharges'
  // batch version (which still exists as a catch-up path for visits logged before their learner
  // had a resolvable guardian). Runs inside the same transaction that created the visit row, so a
  // failure here rolls the visit creation back too rather than leaving an orphaned unbilled visit.
  async invoiceVisitImmediately(hub, visit, payerUserId, req, trx) {
    const now = new Date();
    const invoice = await BillingModel.createInvoice({
      invoiceNumber: await nextInvoiceNumber(trx),
      issuerType: "learning_hub", issuerHubId: hub.id, payerUserId, payerHubId: null,
      learnerId: visit.learnerId, hubId: hub.id, invoiceType: "hub_usage", status: "issued",
      currency: "KES", subtotal: visit.amount, discount: 0, total: visit.amount, amountPaid: 0,
      periodStart: visit.visitDate, periodEnd: visit.visitDate, periodLabel: null,
      issuedAt: now, dueAt: null, notes: null,
    }, trx);
    const classContext = await resolveLearnerClassContext(visit.learnerId, hub.id);
    const spaceLabel = `${resolveSpace(hub, visit.spaceId)?.name || "Space"} - ${visit.visitDate}`;
    const description = classContext ? `${spaceLabel} - ${classContext}` : spaceLabel;
    const item = await BillingModel.createItem({
      invoiceId: invoice.id, learnerId: visit.learnerId, courseId: null,
      description, quantity: visit.pricingModelAtLogging === "hourly" ? Number(visit.hours) : 1,
      unitAmount: Number(visit.rateAtLogging), totalAmount: Number(visit.amount),
      metadata: { hubVisitId: visit.id, spaceId: visit.spaceId },
    }, trx);
    await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId: req.user.id, eventType: "invoice_issued", newStatus: "issued", amount: visit.amount, metadata: { source: "hub_usage" } }, trx);
    await HubVisitModel.markInvoiced({ [visit.id]: item.id }, trx);
    return { invoice, itemId: item.id };
  },
};

const HubVisitService = {
  async logVisit(data, req) {
    const hub = await assertNonSchoolHub(data.hubId);
    await assertHubAccess(req, data.hubId);
    const { link } = await assertLearnerAtHub(data.learnerId, data.hubId);
    const space = resolveSpace(hub, data.spaceId);

    const duplicate = await HubVisitModel.findExisting(data.learnerId, data.spaceId, data.visitDate);
    if (duplicate) throw badRequest("A visit for this learner and space on this date is already logged");

    const { pricingModel, rate, priceUnit } = resolveEffectiveRate(link, space);
    if (pricingModel === "hourly" && !data.hours) throw badRequest("Hours are required for an hourly-priced space");
    const amount = computeAmount({ pricingModel, rate, hours: data.hours });

    // Free spaces have nothing to bill - skip payer resolution and invoicing entirely, same as
    // computeAmount already special-cases "free" to a flat 0.
    const payer = amount > 0 ? await HubVisitInternal.resolvePayerForLearner(data.learnerId) : null;

    return BillingModel.transaction(async (trx) => {
      const visit = await HubVisitModel.create({
        ownerAdminId: hub.ownerAdminId,
        hubId: data.hubId,
        learnerId: data.learnerId,
        spaceId: data.spaceId,
        visitDate: data.visitDate,
        hours: pricingModel === "hourly" ? data.hours : null,
        pricingModelAtLogging: pricingModel,
        rateAtLogging: rate,
        priceUnitAtLogging: priceUnit,
        amount,
        billingStatus: "unbilled",
        loggedByUserId: req.user.id,
        notes: data.notes || null,
      }, trx);

      if (!payer) return { visit, invoice: null };

      const { invoice, itemId } = await HubVisitInternal.invoiceVisitImmediately(hub, visit, payer.payerUserId, req, trx);
      return { visit: { ...visit, billingStatus: "invoiced", invoiceItemId: itemId }, invoice };
    }).then(async ({ visit, invoice }) => {
      if (invoice) await NotificationService.invoiceIssued({ ...invoice, amountDue: invoice.total });
      return visit;
    });
  },

  async getVisit(id, req) {
    const visit = await HubVisitModel.findById(id);
    if (!visit) throw notFound("Visit not found");
    await assertHubAccess(req, visit.hubId);
    return visit;
  },

  async updateVisit(id, data, req) {
    const visit = await HubVisitModel.findById(id);
    if (!visit) throw notFound("Visit not found");
    await assertHubAccess(req, visit.hubId);
    if (visit.billingStatus === "invoiced" && ("hours" in data || "billingStatus" in data)) {
      throw badRequest("This visit has already been invoiced and can no longer be changed");
    }
    const patch = { ...data };
    if ("hours" in data) {
      patch.amount = computeAmount({ pricingModel: visit.pricingModelAtLogging, rate: Number(visit.rateAtLogging), hours: data.hours });
    }
    return HubVisitModel.update(id, patch);
  },

  async deleteVisit(id, req) {
    const visit = await HubVisitModel.findById(id);
    if (!visit) throw notFound("Visit not found");
    await assertHubAccess(req, visit.hubId);
    if (visit.billingStatus === "invoiced") throw badRequest("This visit has already been invoiced and can no longer be deleted");
    await HubVisitModel.delete(id);
    return { message: "Visit deleted successfully" };
  },

  async listVisits(filters, req) {
    let hubId = filters.hubId;
    if (req.user.role === "school") hubId = req.ownSchool?.id || "__none__";
    if (req.user.role === "admin" && hubId) await assertHubAccess(req, hubId);
    let visits;
    if (req.user.role === "admin" && !hubId) {
      const ids = [...(await ownHubIds(req))];
      const perHub = await Promise.all(ids.map((id) => HubVisitModel.findAll({ ...filters, hubId: id })));
      visits = perHub.flat();
    } else {
      visits = await HubVisitModel.findAll({ ...filters, hubId });
    }
    return HubVisitService.attachInvoiceIds(visits);
  },

  // A visit only ever stores invoiceItemId (billing_invoice_items.id), not the invoice's own id -
  // the item already carries invoiceId, so this resolves it in one batched lookup rather than
  // storing it redundantly on hub_visits. Lets the client link an invoiced visit straight to its
  // invoice's detail page (GET /api/billing/:id) instead of only showing "Invoiced" as a label.
  async attachInvoiceIds(visits) {
    const itemIds = [...new Set(visits.map((v) => v.invoiceItemId).filter(Boolean))];
    if (itemIds.length === 0) return visits;
    const items = await BillingModel.findItemsByIds(itemIds);
    const invoiceIdByItemId = new Map(items.map((item) => [item.id, item.invoiceId]));
    return visits.map((v) => (v.invoiceItemId ? { ...v, invoiceId: invoiceIdByItemId.get(v.invoiceItemId) || null } : v));
  },

  // Groups a hub's unbilled visits in [from, to] by learner, checking the same guardian-email
  // payer path billing.service.js's resolveBulkLearners already uses for learner_term invoicing.
  // Shared by previewGenerateCharges (display-trimmed) and generateCharges (needs the full row -
  // payerUserId, the raw visits - to actually create invoices/items).
  async resolveEligibleLearners(data) {
    const visits = await HubVisitModel.findUnbilled({ hubId: data.hubId, from: data.from, to: data.to });
    const byLearner = new Map();
    for (const visit of visits) {
      if (!byLearner.has(visit.learnerId)) byLearner.set(visit.learnerId, []);
      byLearner.get(visit.learnerId).push(visit);
    }
    const rows = [];
    for (const [learnerId, learnerVisits] of byLearner) {
      const learner = await LearnerModel.findById(learnerId);
      const total = money(learnerVisits.reduce((sum, v) => sum + Number(v.amount), 0));
      if (!learner) { rows.push({ learnerId, status: "skipped", reason: "Learner record not found", visitCount: learnerVisits.length, total }); continue; }
      if (!learner.guardianEmail) { rows.push({ learnerId, learner, status: "skipped", reason: "Learner has no guardian email", visitCount: learnerVisits.length, total }); continue; }
      const payer = await UserModel.findByEmail(learner.guardianEmail);
      if (!payer) { rows.push({ learnerId, learner, status: "skipped", reason: "Parent account not found", visitCount: learnerVisits.length, total }); continue; }
      rows.push({ learnerId, learner, payerUserId: payer.id, status: "eligible", reason: null, visitCount: learnerVisits.length, total, visits: learnerVisits });
    }
    return rows;
  },

  async previewGenerateCharges(data, req) {
    await assertNonSchoolHub(data.hubId);
    await assertHubAccess(req, data.hubId);
    const rows = await HubVisitService.resolveEligibleLearners(data);
    return {
      hubId: data.hubId, from: data.from, to: data.to,
      total: rows.length, eligible: rows.filter((r) => r.status === "eligible").length, skipped: rows.filter((r) => r.status === "skipped").length,
      expectedTotal: money(rows.filter((r) => r.status === "eligible").reduce((sum, r) => sum + r.total, 0)),
      learners: rows.map((r) => ({ learnerId: r.learnerId, name: r.learner ? `${r.learner.firstName} ${r.learner.lastName}`.trim() : "Unknown learner", status: r.status, reason: r.reason, visitCount: r.visitCount, total: r.total })),
    };
  },

  // Creates one hub_usage invoice per eligible learner, one billing_invoice_items row per visit
  // (not aggregated - a guardian sees each day/space as its own line), issued immediately. See
  // this module's header + the 20260916110000 migration for why hub_usage bypasses
  // BillingService.createInvoice entirely and writes straight through BillingModel.
  async generateCharges(data, req) {
    const hub = await assertNonSchoolHub(data.hubId);
    await assertHubAccess(req, data.hubId);
    const rows = await HubVisitService.resolveEligibleLearners(data);
    const eligible = rows.filter((r) => r.status === "eligible");
    if (!eligible.length) throw badRequest("No eligible learners found for charge generation");

    const now = new Date();
    const created = [];
    const invoiceItemIdByVisitId = {};
    await BillingModel.transaction(async (trx) => {
      for (const row of eligible) {
        const learnerVisits = row.visits;
        const subtotal = money(learnerVisits.reduce((sum, v) => sum + Number(v.amount), 0));
        const classContext = await resolveLearnerClassContext(row.learnerId, hub.id);
        const invoice = await BillingModel.createInvoice({
          invoiceNumber: await nextInvoiceNumber(trx),
          issuerType: "learning_hub", issuerHubId: data.hubId, payerUserId: row.payerUserId, payerHubId: null,
          learnerId: row.learnerId, hubId: data.hubId, invoiceType: "hub_usage", status: "issued",
          currency: "KES", subtotal, discount: 0, total: subtotal, amountPaid: 0,
          periodStart: data.from, periodEnd: data.to, periodLabel: data.periodLabel || null,
          issuedAt: now, dueAt: data.dueAt || null, notes: null,
        }, trx);
        for (const visit of learnerVisits) {
          const spaceLabel = `${resolveSpace(hub, visit.spaceId)?.name || "Space"} - ${visit.visitDate}`;
          const description = classContext ? `${spaceLabel} - ${classContext}` : spaceLabel;
          const item = await BillingModel.createItem({
            invoiceId: invoice.id, learnerId: row.learnerId, courseId: null,
            description, quantity: visit.pricingModelAtLogging === "hourly" ? Number(visit.hours) : 1,
            unitAmount: Number(visit.rateAtLogging), totalAmount: Number(visit.amount),
            metadata: { hubVisitId: visit.id, spaceId: visit.spaceId },
          }, trx);
          invoiceItemIdByVisitId[visit.id] = item.id;
        }
        await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId: req.user.id, eventType: "invoice_issued", newStatus: "issued", amount: subtotal, metadata: { source: "hub_usage" } }, trx);
        created.push(invoice);
      }
      await HubVisitModel.markInvoiced(invoiceItemIdByVisitId, trx);
    });

    await Promise.all(created.map((invoice) => NotificationService.invoiceIssued({ ...invoice, amountDue: invoice.total })));
    const skipped = rows.filter((r) => r.status === "skipped").map((r) => ({ learnerId: r.learnerId, name: r.learner ? `${r.learner.firstName} ${r.learner.lastName}`.trim() : "Unknown learner", reason: r.reason }));
    return { created: created.length, invoices: created, skipped };
  },

  // Derived on the fly from hub_visits + billing_invoices/items/payments for this hub - no
  // dedicated ledger table, same "derive don't duplicate" posture as billing.service.js's
  // getCustomer.
  async getHubRevenueSummary(hubId, req) {
    await assertNonSchoolHub(hubId);
    await assertHubAccess(req, hubId);
    const visits = await HubVisitModel.findAll({ hubId });
    const invoices = await BillingModel.findInvoices({ hubId, invoiceType: "hub_usage" });
    const payments = (await BillingModel.findPaymentsByInvoiceIds(invoices.map((inv) => inv.id))).filter((p) => p.status === "successful");
    const paidByInvoice = new Map();
    for (const p of payments) paidByInvoice.set(p.invoiceId, money((paidByInvoice.get(p.invoiceId) || 0) + Number(p.amount)));

    const totalInvoiced = money(invoices.reduce((sum, inv) => sum + Number(inv.total), 0));
    const totalPaid = money(invoices.reduce((sum, inv) => sum + (paidByInvoice.get(inv.id) || 0), 0));
    const unbilled = visits.filter((v) => v.billingStatus === "unbilled");
    const unbilledAmount = money(unbilled.reduce((sum, v) => sum + Number(v.amount), 0));

    const bySpace = new Map();
    const byLearner = new Map();
    for (const visit of visits) {
      if (visit.billingStatus === "waived") continue;
      bySpace.set(visit.spaceId, money((bySpace.get(visit.spaceId) || 0) + Number(visit.amount)));
      byLearner.set(visit.learnerId, money((byLearner.get(visit.learnerId) || 0) + Number(visit.amount)));
    }

    return {
      hubId,
      visitCount: visits.length,
      unbilledCount: unbilled.length,
      unbilledAmount,
      totalInvoiced,
      totalPaid,
      totalOutstanding: money(totalInvoiced - totalPaid),
      bySpace: [...bySpace.entries()].map(([spaceId, amount]) => ({ spaceId, amount })),
      byLearner: [...byLearner.entries()].map(([learnerId, amount]) => ({ learnerId, amount })),
    };
  },

  // Admin-only - every non-school hub this admin owns, each with its own summary. Mirrors
  // billing.service.js's listCustomers per-hub array shape.
  async getAllHubsRevenueSummary(req) {
    if (req.user.role !== "admin") throw forbidden("Only the platform administrator can view this");
    const hubs = (await LearningHubService.getAllLearningHubs({ ownerAdminId: req.ownerAdminId, includeDrafts: true }))
      .filter((h) => h.hubType !== "school");
    return Promise.all(hubs.map(async (hub) => ({
      hub: { id: hub.id, name: hub.name, hubType: hub.hubType, status: hub.status },
      ...(await HubVisitService.getHubRevenueSummary(hub.id, req)),
    })));
  },
};

module.exports = HubVisitService;
