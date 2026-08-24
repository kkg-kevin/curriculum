const BillingModel = require("./billing.model");
const LearningHubService = require("../learning-hubs/learning-hub.service");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const UserModel = require("../auth/user.model");
const NotificationService = require("../notifications/notification.service");

function money(value) { return Number(Number(value || 0).toFixed(2)); }
function notFound(message) { const err = new Error(message); err.statusCode = 404; return err; }
function badRequest(message) { const err = new Error(message); err.statusCode = 400; return err; }

function decorate(invoice, items, payments) {
  const amountPaid = money(payments.filter((p) => p.status === "successful").reduce((sum, p) => sum + Number(p.amount), 0));
  return { ...invoice, subtotal: money(invoice.subtotal), discount: money(invoice.discount), total: money(invoice.total), amountPaid, amountDue: money(Number(invoice.total) - amountPaid), items, payments };
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
  if (req.user.role === "learner" && invoice.payerUserId === req.user.id) return;
  throw Object.assign(new Error("You do not have access to this invoice"), { statusCode: 403 });
}

const BillingService = {
  async createInvoice(data, req) {
    const hub = await LearningHubService.getLearningHubById(data.hubId);
    let issuerType = "platform";
    let issuerHubId = null;
    let payerHubId = data.payerHubId || null;
    let payerUserId = data.payerUserId || null;

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

    const subtotal = money(data.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitAmount), 0));
    const discount = money(data.discount);
    if (discount > subtotal) throw badRequest("Discount cannot exceed the invoice subtotal");
    const total = money(subtotal - discount);
    const invoice = await BillingModel.createInvoice({
      invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      issuerType, issuerHubId, payerUserId, payerHubId, learnerId: data.learnerId || null, hubId: hub.id,
      invoiceType: data.invoiceType, status: "draft", currency: "KES", subtotal, discount, total, amountPaid: 0,
      periodStart: data.periodStart || null, periodEnd: data.periodEnd || null, periodLabel: data.periodLabel || null,
      dueAt: data.dueAt || null, notes: data.notes || null,
    });
    const items = [];
    for (const item of data.items) {
      items.push(await BillingModel.createItem({
        invoiceId: invoice.id, learnerId: item.learnerId || data.learnerId || null, courseId: item.courseId || null,
        description: item.description, quantity: item.quantity, unitAmount: money(item.unitAmount),
        totalAmount: money(Number(item.quantity) * Number(item.unitAmount)), metadata: item.metadata || null,
      }));
    }
    return decorate(invoice, items, []);
  },

  async listInvoices(req) {
    const filters = {};
    if (req.user.role === "school") filters.hubId = req.ownSchool?.id || "__none__";
    if (req.user.role === "learner") filters.payerUserId = req.user.id;
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
    const updated = await BillingModel.updateInvoice(id, { status: "issued", issuedAt: new Date() });
    const full = decorate(updated, await BillingModel.findItems(id), await BillingModel.findPayments(id));
    if (full.payerUserId) await NotificationService.invoiceIssued(full);
    return full;
  },

  async cancelInvoice(id, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    if (req.user.role !== "admin" && !(req.user.role === "school" && invoice.issuerHubId === req.ownSchool?.id)) throw Object.assign(new Error("You do not have permission to cancel this invoice"), { statusCode: 403 });
    if (["paid", "partially_paid", "cancelled"].includes(invoice.status)) throw badRequest("This invoice cannot be cancelled");
    const updated = await BillingModel.updateInvoice(id, { status: "cancelled" });
    return decorate(updated, await BillingModel.findItems(id), await BillingModel.findPayments(id));
  },

  async recordPayment(id, data, req) {
    const invoice = await BillingModel.findInvoiceById(id);
    if (!invoice) throw notFound("Invoice not found");
    await assertAccess(req, invoice);
    if (!["issued", "partially_paid", "overdue"].includes(invoice.status)) throw badRequest("This invoice is not payable");
    const currentPaid = money((await BillingModel.sumSuccessfulPayments(id))?.total);
    if (money(currentPaid + data.amount) > money(invoice.total)) throw badRequest("Payment exceeds the amount due");
    const payment = await BillingModel.createPayment({ invoiceId: id, payerUserId: req.user.id, provider: "manual", providerReference: data.providerReference || null, amount: money(data.amount), currency: invoice.currency, status: "successful", paymentMethod: data.paymentMethod, paidAt: new Date(), metadata: data.notes ? { notes: data.notes } : null });
    const newPaid = money(currentPaid + data.amount);
    const updated = await BillingModel.updateInvoice(id, { amountPaid: newPaid, status: newPaid >= money(invoice.total) ? "paid" : "partially_paid", paidAt: newPaid >= money(invoice.total) ? new Date() : null });
    return decorate(updated, await BillingModel.findItems(id), [payment, ...(await BillingModel.findPayments(id))]);
  },
};

module.exports = BillingService;
