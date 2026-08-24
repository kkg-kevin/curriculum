const BillingModel = require("./billing.model");
const LearningHubService = require("../learning-hubs/learning-hub.service");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const UserModel = require("../auth/user.model");
const NotificationService = require("../notifications/notification.service");
const ClassModel = require("../classes/class.model");

function money(value) { return Number(Number(value || 0).toFixed(2)); }
function notFound(message) { const err = new Error(message); err.statusCode = 404; return err; }
function badRequest(message) { const err = new Error(message); err.statusCode = 400; return err; }
function forbidden(message) { const err = new Error(message); err.statusCode = 403; return err; }
function invoiceNumber() { return `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }
function receiptNumber() { return `RCT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }

async function decorate(invoice, items, payments) {
  const amountPaid = money(payments.filter((p) => p.status === "successful").reduce((sum, p) => sum + Number(p.amount), 0));
  return { ...invoice, subtotal: money(invoice.subtotal), discount: money(invoice.discount), total: money(invoice.total), amountPaid, amountDue: money(Number(invoice.total) - amountPaid), items, payments, auditEvents: await BillingModel.findAuditEvents(invoice.id) };
}

async function assertLearnerAtHub(learnerId, hubId) {
  const learner = await LearnerModel.findById(learnerId);
  if (!learner) throw notFound("Learner not found");
  const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
  if (!links.some((link) => link.hubId === hubId)) throw badRequest("Learner is not enrolled at this learning hub");
  return learner;
}

async function assertAccess(req, invoice) {
  if (req.user.role === "admin") return;
  if (req.user.role === "school") {
    if (invoice.hubId !== req.ownSchool?.id) throw Object.assign(new Error("You do not have access to this invoice"), { statusCode: 403 });
    return;
  }
  if (req.user.role === "learner" && req.user.username) throw forbidden("Learner accounts cannot access invoices");
  if (req.user.role === "learner" && invoice.learnerId === req.ownLearner?.id) return;
  throw Object.assign(new Error("You do not have access to this invoice"), { statusCode: 403 });
}

const BillingService = {
  async resolveBulkLearners(data, req) {
    if (req.user.role === "school" && data.hubId !== req.ownSchool?.id) throw forbidden("You can only invoice your own learning hub");
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
        const invoice = await BillingModel.createInvoice({ invoiceNumber: invoiceNumber(), batchId: batch.id, issuerType: "learning_hub", issuerHubId: data.hubId, payerUserId: row.payerUserId, payerHubId: null, learnerId: row.learnerId, hubId: data.hubId, invoiceType: data.invoiceType, status: "issued", currency: "KES", subtotal: data.unitAmount, discount: 0, total: data.unitAmount, amountPaid: 0, periodLabel: data.periodLabel || null, issuedAt: now, dueAt: data.dueAt || null, notes: data.notes || null }, trx);
        await BillingModel.createItem({ invoiceId: invoice.id, learnerId: row.learnerId, courseId: null, description: data.description, quantity: 1, unitAmount: data.unitAmount, totalAmount: data.unitAmount, metadata: { batchId: batch.id } }, trx);
        await BillingModel.createAuditEvent({ invoiceId: invoice.id, batchId: batch.id, actorUserId: req.user.id, eventType: "invoice_issued", newStatus: "issued", amount: data.unitAmount, metadata: { source: "bulk_invoice" } }, trx);
        created.push(invoice);
      }
      await BillingModel.updateBatch(batch.id, { status: rows.length === eligible.length ? "completed" : "completed_with_errors", createdInvoices: created.length, totalAmount: money(created.length * data.unitAmount) }, trx);
    });
    await Promise.all(created.map((invoice) => NotificationService.invoiceIssued({ ...invoice, amountDue: invoice.total })));
    return { batch: { ...batch, status: rows.length === eligible.length ? "completed" : "completed_with_errors", createdInvoices: created.length, skippedLearners: rows.length - eligible.length, totalAmount: money(created.length * data.unitAmount) }, created: created.length, skipped: rows.filter((row) => row.status === "skipped").map((row) => ({ learnerId: row.learnerId, name: row.learner ? `${row.learner.firstName} ${row.learner.lastName}`.trim() : "Unknown learner", reason: row.reason })) };
  },

  async listBatches(req) {
    const filters = req.user.role === "school" ? { hubId: req.ownSchool?.id || "__none__" } : {};
    return BillingModel.findBatches(filters);
  },

  async createInvoice(data, req) {
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
      invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
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
    if (req.user.role === "learner") {
      if (req.user.username) return [];
      filters.learnerId = req.ownLearner?.id || "__none__";
    }
    const invoices = await BillingModel.findInvoices(filters);
    return Promise.all(invoices.map(async (invoice) => decorate(invoice, await BillingModel.findItems(invoice.id), await BillingModel.findPayments(invoice.id))));
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
    const updated = await BillingModel.updateInvoice(id, data);
    return decorate(updated, await BillingModel.findItems(id), await BillingModel.findPayments(id));
  },

  async issueInvoice(id, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    if (req.user.role !== "admin" && !(req.user.role === "school" && invoice.issuerHubId === req.ownSchool?.id)) throw Object.assign(new Error("You do not have permission to issue this invoice"), { statusCode: 403 });
    if (invoice.status !== "draft") throw badRequest("Only draft invoices can be issued");
    let updated;
    await BillingModel.transaction(async (trx) => {
      updated = await BillingModel.updateInvoice(id, { status: "issued", issuedAt: new Date() }, trx);
      await BillingModel.createAuditEvent({ invoiceId: id, actorUserId: req.user.id, eventType: "invoice_issued", previousStatus: invoice.status, newStatus: "issued", amount: invoice.total }, trx);
    });
    const full = await decorate(updated, await BillingModel.findItems(id), await BillingModel.findPayments(id));
    if (full.payerUserId) await NotificationService.invoiceIssued(full);
    return full;
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

  async recordPayment(id, data, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    await assertAccess(req, invoice);
    const existingPayment = await BillingModel.findPaymentByIdempotencyKey(data.idempotencyKey);
    if (existingPayment) return decorate(invoice, await BillingModel.findItems(id), await BillingModel.findPayments(id));
    if (!["issued", "partially_paid", "overdue"].includes(invoice.status)) throw badRequest("This invoice is not payable");
    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    if (Number.isNaN(paymentDate.getTime())) throw badRequest("Payment date is invalid");
    let payment;
    let updated;
    await BillingModel.transaction(async (trx) => {
      const lockedInvoice = await BillingModel.findInvoiceById(id, trx, true);
      if (!lockedInvoice) throw notFound("Invoice not found");
      const retriedPayment = await BillingModel.findPaymentByIdempotencyKey(data.idempotencyKey, trx);
      if (retriedPayment) {
        payment = retriedPayment;
        updated = lockedInvoice;
        return;
      }
      if (!["issued", "partially_paid", "overdue"].includes(lockedInvoice.status)) throw badRequest("This invoice is not payable");
      const currentPaid = money((await BillingModel.sumSuccessfulPayments(id, trx))?.total);
      if (money(currentPaid + data.amount) > money(lockedInvoice.total)) throw badRequest("Payment exceeds the amount due");
      const newPaid = money(currentPaid + data.amount);
      const newStatus = newPaid >= money(lockedInvoice.total) ? "paid" : "partially_paid";
      payment = await BillingModel.createPayment({ invoiceId: id, payerUserId: invoice.payerUserId || req.user.id, recordedBy: req.user.id, idempotencyKey: data.idempotencyKey || null, provider: "manual", providerReference: data.providerReference || null, receiptNumber: data.receiptNumber || receiptNumber(), amount: money(data.amount), currency: invoice.currency, status: "successful", paymentMethod: data.paymentMethod, paymentDate, paidAt: paymentDate, notes: data.notes || null }, trx);
      updated = await BillingModel.updateInvoice(id, { amountPaid: newPaid, status: newStatus, paidAt: newStatus === "paid" ? new Date() : null }, trx);
      await BillingModel.createAuditEvent({ invoiceId: id, paymentId: payment.id, batchId: lockedInvoice.batchId || null, actorUserId: req.user.id, eventType: "payment_recorded", previousStatus: lockedInvoice.status, newStatus, amount: data.amount, metadata: { paymentMethod: data.paymentMethod, receiptNumber: payment.receiptNumber } }, trx);
    });
    return decorate(updated, await BillingModel.findItems(id), await BillingModel.findPayments(id));
  },
};

module.exports = BillingService;
