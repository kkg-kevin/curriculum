const db = require("../../config/db");
const { createRecord, firstOrNull, toJson } = require("../../shared/utils/model.utils");
const { requirePublicContentAdminId } = require("../../shared/utils/public-content");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { kenyaToday } = require("../../shared/utils/age");
const BillingModel = require("../billing/billing.model");
const ItemsModel = require("../settings/items/items.model");
const AssessmentModel = require("../assessments/assessment.model");
const AssessmentIssueModel = require("../assessments/submissions/assessment-issue.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const LearnerService = require("../learners/learner.service");
const LearnerModel = require("../learners/learner.model");
const AuthService = require("../auth/auth.service");
const UserModel = require("../auth/user.model");
const NotificationService = require("../notifications/notification.service");
const PaymentLinks = require("../payments/payment-links");
const PaymentOptions = require("../payments/payment-options");
const { parentLoginFor } = require("../auth/parent-login");
const { sendOrderPlacedEmail, sendOrderStatusEmail } = require("./orders.emails");

// Buying on the website: the Store's goods and for-sale Projects in one cart. A checkout becomes
// an order with an invoice ("store_order"), so it's paid exactly like a sign-up — the Payment
// step's methods, "I've paid" notices staff confirm, M-Pesa once it's live — and an invoice paid
// in full calls activateForPaidInvoice (billing.paid-hooks.js), which marks the order paid and
// gives the child the projects bought.
//
// Store items are bought as a guest (the order carries the shopper's name, email and phone).
// Projects need someone to give them to, so a cart with projects also makes (or uses) the
// parent's login and a child's login, the way a bootcamp enrolment does; that child is enrolled
// at the order's hub without a class and the projects are issued to them directly.
//
// Prices are always read from the item or project at checkout, never from the cart, and fixed on
// the order's lines. Status: awaiting_payment → paid → preparing → ready_for_pickup (pickup) or
// dispatched (delivery) → completed; cancelled at any point before completed. An order with
// nothing to hand over (only project access) completes when it's paid.

const ORDERS = "orders";
const ITEMS = "order_items";
const PAYABLE = ["issued", "partially_paid", "overdue"];
const OPEN = ["awaiting_payment", "paid", "preparing", "ready_for_pickup", "dispatched"];
const NEXT = {
  awaiting_payment: ["cancelled"],
  paid: ["preparing", "ready_for_pickup", "dispatched", "completed", "cancelled"],
  preparing: ["ready_for_pickup", "dispatched", "completed", "cancelled"],
  ready_for_pickup: ["completed", "cancelled"],
  dispatched: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const STATUS_LABEL = {
  awaiting_payment: "Awaiting payment", paid: "Paid", preparing: "Being prepared", ready_for_pickup: "Ready for pickup",
  dispatched: "Dispatched", completed: "Completed", cancelled: "Cancelled",
};

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const money = (value) => Number(Number(value || 0).toFixed(2));
const formatKes = (value, currency = "KES") => `${currency} ${money(value).toLocaleString("en-KE")}`;
const arr = (value) => (Array.isArray(value) ? value : []);

async function nextOrderNumber(trx) {
  const year = new Date().getFullYear();
  return `ORD-${year}-${String(await BillingModel.nextNumber("order", year, trx)).padStart(6, "0")}`;
}
async function nextInvoiceNumber(trx) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`;
}

function splitName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "Learner", lastName: parts.slice(1).join(" ") || "-" };
}

// The hubs a Store order can be collected from: the store owner's active, in-person, non-school
// hubs (not the Home Learning hub, which is a family's home).
async function pickupHubs(ownerAdminId) {
  const hubs = await LearningHubModel.findAll({ ownerAdminId, status: "active" });
  return hubs
    .filter((h) => h.hubType !== "school" && !h.isHomeLearning && (h.deliveryMode || "in_person") !== "virtual")
    .map((h) => ({ id: h.id, name: h.name, town: [h.address?.city, h.address?.county].filter(Boolean).join(", ") }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// The hub an order (its invoice, and the child it enrols) belongs to: the pickup hub, or the first
// pickup hub, or any hub of the store owner.
async function orderHubId(ownerAdminId, pickupHubId, hubs) {
  if (pickupHubId) return pickupHubId;
  if (hubs[0]) return hubs[0].id;
  const any = (await LearningHubModel.findAll({ ownerAdminId })).find((h) => h.status === "active") || null;
  if (!any) fail("The shop isn't ready to take orders yet. Please contact us.", 503);
  return any.id;
}

// The cart, checked against what's actually for sale, with today's prices.
async function resolveLines(ownerAdminId, lines) {
  const [goods, projects] = await Promise.all([ItemsModel.findForSaleItems(ownerAdminId), AssessmentModel.findForSaleProjects(ownerAdminId)]);
  const goodById = new Map(goods.map((g) => [g.id, g]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const merged = new Map();
  for (const line of lines) {
    const key = `${line.type}:${line.id}`;
    const seen = merged.get(key);
    if (line.type === "store_item") merged.set(key, { ...line, quantity: Math.min(20, (seen?.quantity || 0) + line.quantity) });
    else merged.set(key, { ...line, withKit: Boolean(seen?.withKit || line.withKit) });
  }

  const out = [];
  for (const line of merged.values()) {
    if (line.type === "store_item") {
      const item = goodById.get(line.id);
      if (!item) fail("Something in your cart is no longer sold. Please remove it and try again.", 409);
      if (item.priceAmount == null) fail(`${item.name} has no price yet — please enquire about it instead.`, 409);
      if (item.stockStatus === "coming_soon") fail(`${item.name} isn't available yet.`, 409);
      const unit = money(item.priceAmount);
      out.push({ kind: "store_item", refId: item.id, name: item.name, image: item.image || null, unitPrice: unit, quantity: line.quantity, lineTotal: money(unit * line.quantity), currency: item.priceCurrency || "KES" });
    } else {
      const project = projectById.get(line.id);
      if (!project) fail("A project in your cart is no longer sold. Please remove it and try again.", 409);
      if (project.priceAmount == null) fail(`${project.name} has no price yet — please enquire about it instead.`, 409);
      const unit = money(project.priceAmount);
      out.push({ kind: "project", refId: project.id, name: project.name, image: project.coverImage || null, unitPrice: unit, quantity: 1, lineTotal: unit, currency: project.priceCurrency || "KES" });
      if (line.withKit) {
        if (project.kitPriceAmount == null) fail(`${project.name} isn't sold with a kit.`, 409);
        const kit = money(project.kitPriceAmount);
        out.push({ kind: "project_kit", refId: project.id, name: `${project.name} — materials kit`, image: project.coverImage || null, unitPrice: kit, quantity: 1, lineTotal: kit, currency: project.priceCurrency || "KES" });
      }
    }
  }
  const currencies = new Set(out.map((l) => l.currency));
  if (currencies.size > 1) fail("Items priced in different currencies can't be bought together.");
  return out;
}

// The child an order's projects go to: an existing one (by username, on this parent's email) or a
// new learner with their own login, enrolled at the order's hub without a class and locked until
// the order is paid. Returns { learner, created }.
async function childFor(child, customer, hubId) {
  if (child.mode === "existing") {
    const learner = await LearnerModel.findByUsername(child.username.trim());
    if (!learner || String(learner.guardianEmail || "").toLowerCase() !== customer.email.toLowerCase()) {
      fail("We couldn't find a child with that username on your account. Check the username, or add a new child.");
    }
    return { learner, created: false };
  }
  const { firstName, lastName } = splitName(child.name);
  const learner = await LearnerService.createLearner({
    firstName, lastName, gender: null, // checkout doesn't ask; set on the learner later
    dateOfBirth: child.dateOfBirth || "",
    // No date of birth (an older website): the age they gave places them instead.
    ...(child.dateOfBirth ? {} : { statedAge: child.age, statedAgeOn: kenyaToday() }),
    guardianName: customer.name, guardianPhone: customer.phone, guardianEmail: customer.email,
    username: child.username, accountStatus: "pending_payment",
  });
  try {
    await AuthService.setOrCreatePasswordByUsername({ name: child.name, username: child.username, password: child.password, role: "learner" });
    await LearnerService.enrollInHub(learner.id, { hubId, classId: null, status: "active" });
  } catch (err) {
    await LearnerService.deleteLearner(learner.id).catch(() => {});
    throw err;
  }
  return { learner, created: true };
}

function pushHistory(order, status, actorUserId = null, note = null) {
  return toJson([...arr(order.history), { status, at: new Date().toISOString(), by: actorUserId, note: note || null }]);
}

function staffView(order, items, extra = {}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: STATUS_LABEL[order.status] || order.status,
    customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone },
    fulfilment: order.fulfilment,
    pickupHubId: order.pickupHubId,
    delivery: order.fulfilment === "delivery" ? { address: order.deliveryAddress, town: order.deliveryTown, county: order.deliveryCounty, note: order.deliveryNote } : null,
    subtotal: money(order.subtotal),
    deliveryFee: money(order.deliveryFee),
    total: money(order.total),
    currency: order.currency,
    invoiceId: order.invoiceId,
    childName: order.childName,
    learnerId: order.learnerId,
    history: arr(order.history),
    next: NEXT[order.status].filter((s) => (s !== "ready_for_pickup" || order.fulfilment === "pickup") && (s !== "dispatched" || order.fulfilment === "delivery")),
    createdAt: order.createdAt,
    items: items.map((i) => ({ id: i.id, kind: i.kind, refId: i.refId, name: i.name, image: toAbsoluteMediaUrl(i.image), unitPrice: money(i.unitPrice), quantity: i.quantity, lineTotal: money(i.lineTotal) })),
    ...extra,
  };
}

function assertWorkspace(req) {
  if (req.user.role !== "admin" || !req.ownerAdminId) fail("Only the workspace's billing staff can see orders", 403);
}

async function ownOrder(id, req) {
  assertWorkspace(req);
  const order = await firstOrNull(db(ORDERS).where({ id }));
  if (!order || order.ownerAdminId !== req.ownerAdminId) fail("Order not found", 404);
  return order;
}

// Every project on a paid order, given to its child — idempotent (one standalone issue per
// project and child), and the child's login unlocked if the order made it.
async function deliverProjects(order, items) {
  if (!order.learnerId) return;
  for (const item of items.filter((i) => i.kind === "project")) {
    const existing = await AssessmentIssueModel.findOneStandalone({ assessmentId: item.refId, learnerId: order.learnerId });
    if (!existing) {
      await AssessmentIssueModel.create({
        assessmentId: item.refId, learnerId: order.learnerId, hubId: order.hubId || null,
        sessionId: null, courseId: null, classId: null, issuedBy: "system", dueDate: null,
      });
    }
  }
  const learner = await LearnerModel.findById(order.learnerId);
  if (learner?.accountStatus === "pending_payment") await LearnerModel.update(learner.id, { accountStatus: "active" });
}

const OrdersService = {
  STATUS_LABEL,

  // GET /api/public/checkout — what the checkout needs before the shopper fills it in.
  async checkoutOptions() {
    const ownerAdminId = requirePublicContentAdminId();
    const { options } = await PaymentOptions.forOwner(ownerAdminId);
    const hubs = options.pickup.enabled ? await pickupHubs(ownerAdminId) : [];
    return {
      pickup: { enabled: options.pickup.enabled && hubs.length > 0, note: options.pickup.note || null, hubs },
      delivery: { enabled: options.delivery.enabled, fee: money(options.delivery.fee), note: options.delivery.note || null },
    };
  },

  // POST /api/public/orders — the cart, checked out.
  async placeOrder(data, visitSource = null) {
    if (data.hp_field) fail("Your order couldn't be sent. Please try again.");
    const ownerAdminId = requirePublicContentAdminId();
    const lines = await resolveLines(ownerAdminId, data.lines);
    const currency = lines[0]?.currency || "KES";
    const hasPhysical = lines.some((l) => l.kind !== "project");
    const hasProjects = lines.some((l) => l.kind === "project");
    const { options } = await PaymentOptions.forOwner(ownerAdminId);

    // How it reaches them.
    const f = data.fulfilment;
    let method = hasPhysical ? f.method : "none";
    let pickupHubId = null;
    let deliveryFee = 0;
    const hubs = options.pickup.enabled ? await pickupHubs(ownerAdminId) : [];
    if (hasPhysical) {
      if (method === "pickup") {
        if (!options.pickup.enabled || !hubs.length) fail("Collecting from a hub isn't available right now — choose delivery.");
        if (!hubs.some((h) => h.id === f.hubId)) fail("Choose the hub you'll collect your order from.");
        pickupHubId = f.hubId;
      } else if (method === "delivery") {
        if (!options.delivery.enabled) fail("Delivery isn't available right now — choose to collect from a hub.");
        if (!f.address || !f.town || !f.county) fail("Enter the delivery address, town and county.");
        deliveryFee = money(options.delivery.fee);
      } else {
        fail("Choose how you'd like to get your order.");
      }
    } else {
      method = "none";
    }

    // Projects need a parent login and a child to give them to.
    let existingParent = null;
    if (hasProjects) {
      if (!data.parentPassword) fail("Choose a password for your parent account — you'll use it to follow your child's projects.");
      if (!data.child) fail("Tell us which child the projects are for.");
      existingParent = await parentLoginFor(data.customer.email, data.parentPassword);
    }

    const hubId = await orderHubId(ownerAdminId, pickupHubId, hubs);
    const hub = await LearningHubModel.findById(hubId);
    const subtotal = money(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const total = money(subtotal + deliveryFee);
    if (total <= 0) fail("There's nothing to pay for in your cart.");

    let child = null;
    let parentUserId = existingParent?.id || null;
    let createdParentId = null;
    if (hasProjects) {
      try {
        child = await childFor(data.child, data.customer, hubId);
        if (!existingParent) {
          const parent = await AuthService.createUser({ name: data.customer.name, email: data.customer.email, password: data.parentPassword, role: "learner" });
          createdParentId = parent.id;
          parentUserId = parent.id;
        } else if (existingParent.role !== "learner") {
          await AuthService.linkExistingLogin(data.customer.email, "learner");
        }
      } catch (err) {
        if (child?.created) await LearnerService.deleteLearner(child.learner.id).catch(() => {});
        if (createdParentId) await UserModel.delete(createdParentId).catch(() => {});
        throw err;
      }
    }

    const now = new Date();
    let order;
    let invoice;
    let items;
    try {
      await BillingModel.transaction(async (trx) => {
        order = await createRecord(trx, ORDERS, {
          orderNumber: await nextOrderNumber(trx),
          ownerAdminId: hub.ownerAdminId,
          status: "awaiting_payment",
          customerName: data.customer.name, customerEmail: data.customer.email, customerPhone: data.customer.phone,
          fulfilment: method, pickupHubId,
          deliveryAddress: method === "delivery" ? f.address : null,
          deliveryTown: method === "delivery" ? f.town : null,
          deliveryCounty: method === "delivery" ? f.county : null,
          deliveryNote: method === "delivery" ? f.note || null : null,
          subtotal, deliveryFee, total, currency, hubId,
          parentUserId, learnerId: child?.learner.id || null,
          childName: child ? `${child.learner.firstName} ${child.learner.lastName === "-" ? "" : child.learner.lastName}`.trim() : null,
          history: toJson([{ status: "awaiting_payment", at: now.toISOString(), by: null, note: null }]),
          visitSource: visitSource ? String(visitSource).slice(0, 100) : null,
        });
        items = [];
        for (const l of lines) {
          items.push(await createRecord(trx, ITEMS, { orderId: order.id, kind: l.kind, refId: l.refId, name: l.name.slice(0, 200), image: l.image, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal }, { updatedAt: false }));
        }
        invoice = await BillingModel.createInvoice({
          invoiceNumber: await nextInvoiceNumber(trx),
          issuerType: "learning_hub", issuerHubId: hubId, payerUserId: parentUserId, payerHubId: null,
          learnerId: child?.learner.id || null, hubId, invoiceType: "store_order", status: "issued", currency,
          subtotal: total, discount: 0, total, amountPaid: 0, issuedAt: now, notes: `Website order ${order.orderNumber}`,
        }, trx);
        for (const l of lines) {
          await BillingModel.createItem({
            invoiceId: invoice.id, learnerId: child?.learner.id || null, courseId: null, description: l.name.slice(0, 250),
            quantity: l.quantity, unitAmount: l.unitPrice, totalAmount: l.lineTotal, metadata: { orderId: order.id, kind: l.kind, refId: l.refId },
          }, trx);
        }
        if (deliveryFee > 0) {
          await BillingModel.createItem({ invoiceId: invoice.id, learnerId: null, courseId: null, description: "Delivery", quantity: 1, unitAmount: deliveryFee, totalAmount: deliveryFee, metadata: { orderId: order.id, kind: "delivery" } }, trx);
        }
        await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId: null, eventType: "invoice_issued", newStatus: "issued", amount: total, metadata: { source: "store_order", orderNumber: order.orderNumber } }, trx);
        await trx(ORDERS).where({ id: order.id }).update({ invoiceId: invoice.id });
        order.invoiceId = invoice.id;
      });
    } catch (err) {
      if (child?.created) await LearnerService.deleteLearner(child.learner.id).catch(() => {});
      if (createdParentId) await UserModel.delete(createdParentId).catch(() => {});
      throw err;
    }

    const pay = await PaymentLinks.forWebsite(invoice, "store_order", { ttlHours: 14 * 24 });
    sendOrderPlacedEmail({ order, items, hubName: pickupHubId ? hub?.name : null, payToken: pay?.token, hasProjects }).catch(() => {});
    await NotificationService._notify(order.ownerAdminId, {
      type: "store_order_placed",
      title: "New website order",
      message: `${order.customerName} ordered ${items.length} ${items.length === 1 ? "item" : "items"} (${formatKes(total, currency)}) — ${order.orderNumber}. It shows as paid once the money is in.`,
      payload: { route: `/billing?tab=orders&order=${order.id}` },
      dedupeKey: `store_order_placed:${order.id}`,
      ownerAdminId: order.ownerAdminId,
    }).catch(() => {});

    return {
      orderNumber: order.orderNumber,
      invoiceNumber: invoice.invoiceNumber,
      currency,
      subtotal,
      deliveryFee,
      total,
      amountDue: total,
      fulfilment: { method, hubName: pickupHubId ? hub?.name : null },
      items: items.map((i) => ({ kind: i.kind, name: i.name, quantity: i.quantity, lineTotal: money(i.lineTotal) })),
      parentAccount: hasProjects ? { email: data.customer.email, existing: Boolean(existingParent) } : null,
      child: child ? { name: order.childName, username: child.learner.username || data.child.username, created: child.created } : null,
      pay,
    };
  },

  // An invoice paid in full (billing.paid-hooks.js): its Store order is paid, the projects go to
  // the child, and an order with nothing to hand over is complete.
  async activateForPaidInvoice(invoice) {
    if (invoice.invoiceType !== "store_order") return;
    const order = await firstOrNull(db(ORDERS).where({ invoiceId: invoice.id }));
    if (!order || order.status !== "awaiting_payment") return;
    const items = await db(ITEMS).where({ orderId: order.id });
    const physical = items.some((i) => i.kind !== "project");
    const status = physical ? "paid" : "completed";
    await db(ORDERS).where({ id: order.id }).update({ status, history: pushHistory(order, status, null, "Payment received"), updatedAt: new Date() });
    await deliverProjects(order, items);
    await NotificationService._notify(order.ownerAdminId, {
      type: "store_order_paid",
      title: "Website order paid",
      message: physical
        ? `${order.orderNumber} (${order.customerName}) is paid — ready to prepare for ${order.fulfilment === "pickup" ? "pickup" : "delivery"}.`
        : `${order.orderNumber} (${order.customerName}) is paid and the projects are in the child's account.`,
      payload: { route: `/billing?tab=orders&order=${order.id}` },
      dedupeKey: `store_order_paid:${order.id}`,
      ownerAdminId: order.ownerAdminId,
    }).catch(() => {});
  },

  // Billing → Orders.
  async list(req, { status = "open" } = {}) {
    assertWorkspace(req);
    let query = db(ORDERS).where({ ownerAdminId: req.ownerAdminId }).orderBy("createdAt", "desc").limit(500);
    if (status === "open") query = query.whereIn("status", OPEN);
    else if (status !== "all") query = query.andWhere({ status });
    const orders = await query;
    const items = orders.length ? await db(ITEMS).whereIn("orderId", orders.map((o) => o.id)) : [];
    const byOrder = new Map();
    for (const i of items) byOrder.set(i.orderId, [...(byOrder.get(i.orderId) || []), i]);
    const counts = Object.fromEntries((await db(ORDERS).where({ ownerAdminId: req.ownerAdminId }).groupBy("status").select("status").count({ count: "*" })).map((r) => [r.status, Number(r.count)]));
    return { orders: orders.map((o) => staffView(o, byOrder.get(o.id) || [])), counts };
  },

  async get(id, req) {
    const order = await ownOrder(id, req);
    const [items, invoice, pickupHub, learner] = await Promise.all([
      db(ITEMS).where({ orderId: order.id }),
      order.invoiceId ? BillingModel.findInvoiceById(order.invoiceId) : null,
      order.pickupHubId ? LearningHubModel.findById(order.pickupHubId) : null,
      order.learnerId ? LearnerModel.findById(order.learnerId) : null,
    ]);
    return staffView(order, items, {
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status, total: money(invoice.total), amountPaid: money(invoice.amountPaid) } : null,
      pickupHub: pickupHub ? { id: pickupHub.id, name: pickupHub.name } : null,
      learner: learner ? { id: learner.id, username: learner.username, accountStatus: learner.accountStatus } : null,
    });
  },

  // Moving an order along; the family hears about the steps that matter to them.
  async updateStatus(id, { status, note }, req) {
    const order = await ownOrder(id, req);
    const allowed = staffView(order, []).next;
    if (!allowed.includes(status)) fail(`An order that is "${STATUS_LABEL[order.status]}" can't be marked "${STATUS_LABEL[status]}"`, 409);
    if (status === "cancelled" && order.invoiceId) {
      const invoice = await BillingModel.findInvoiceById(order.invoiceId);
      if (invoice && PAYABLE.includes(invoice.status) && Number(invoice.amountPaid || 0) <= 0) {
        await BillingModel.transaction(async (trx) => {
          await BillingModel.updateInvoice(invoice.id, { status: "cancelled" }, trx);
          await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId: req.user.id, eventType: "invoice_cancelled", previousStatus: invoice.status, newStatus: "cancelled", metadata: { orderNumber: order.orderNumber } }, trx);
        });
      }
    }
    await db(ORDERS).where({ id }).update({ status, history: pushHistory(order, status, req.user.id, note), updatedAt: new Date() });
    const updated = await firstOrNull(db(ORDERS).where({ id }));
    const hub = order.pickupHubId ? await LearningHubModel.findById(order.pickupHubId) : null;
    sendOrderStatusEmail({ order: updated, status, note, hubName: hub?.name }).catch(() => {});
    return OrdersService.get(id, req);
  },
};

module.exports = OrdersService;
module.exports._internal = { resolveLines, NEXT };
