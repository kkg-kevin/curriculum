// Store order emails (orders.service.js): "we've got your order" with how to pay, and the
// updates a family waits for — ready to collect, on its way, cancelled. Sent through the email
// outbox, which never throws — callers fire these and move on. A guest shopper has no portal
// login, so links go to the website (its /pay/:token page), not the portal.
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail } = require("../../shared/mail/mail.layout");
const env = require("../../config/env");

const formatMoney = (amount, currency) => `${currency || "KES"} ${Number(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

// The website the family ordered on: MAIL_WEBSITE_URL, else the first https PUBLIC_SITE_URL (any
// one locally).
function websiteBase() {
  const sites = String(env.PUBLIC_SITE_URL || "").split(",").map((s) => s.trim()).filter(Boolean);
  return (env.MAIL_WEBSITE_URL || sites.find((s) => /^https:\/\//i.test(s)) || sites[0] || "").replace(/\/+$/, "");
}

const lineRows = (items, currency) => items.map((i) => [`${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`, formatMoney(i.lineTotal, currency)]);

function fulfilmentLine(order, hubName) {
  if (order.fulfilment === "pickup") return `You'll collect it at ${hubName || "your learning hub"} — we'll email you when it's ready.`;
  if (order.fulfilment === "delivery") return `We'll deliver it to ${[order.deliveryAddress, order.deliveryTown, order.deliveryCounty].filter(Boolean).join(", ")} — we'll email you when it's on its way.`;
  return null;
}

// Right after checkout: the order, the total, and a link back to the website to pay.
function sendOrderPlacedEmail({ order, items, hubName, payToken, hasProjects }) {
  const base = websiteBase();
  const payUrl = payToken && base ? `${base}/pay/${encodeURIComponent(payToken)}` : null;
  const { html, text } = renderEmail({
    tone: "info", icon: "document", eyebrow: "Order received",
    preview: `${formatMoney(order.total, order.currency)} to pay — order ${order.orderNumber}`,
    heading: `Thanks for your order, ${firstName(order.customerName)}`,
    highlight: { label: "Amount to pay", value: formatMoney(order.total, order.currency), note: `Order ${order.orderNumber}` },
    rows: [
      ...lineRows(items, order.currency),
      ...(Number(order.deliveryFee) > 0 ? [["Delivery", formatMoney(order.deliveryFee, order.currency)]] : []),
      ["Total", formatMoney(order.total, order.currency)],
    ],
    paragraphs: [
      "We've got your order. Pay using any of the options on the payment page and tell us once you have — we'll confirm it and get things moving.",
      fulfilmentLine(order, hubName),
      hasProjects ? "The projects open in your child's learner account as soon as your payment is confirmed." : null,
    ].filter(Boolean),
    button: payUrl ? { label: "Pay for your order", url: payUrl } : undefined,
    afterParagraphs: payUrl ? ["The payment link works for 14 days. After that, reply to this email and we'll help."] : [],
  });
  return queueMail({ to: order.customerEmail, subject: `Order ${order.orderNumber} — ${formatMoney(order.total, order.currency)} to pay`, html, text, template: "store_order_placed", dedupeKey: `store_order_placed:${order.id}` });
}

const STATUS_COPY = {
  ready_for_pickup: (order, hubName) => ({
    tone: "success", icon: "check", eyebrow: "Ready to collect",
    heading: `Your order is ready to collect`,
    paragraphs: [`Order ${order.orderNumber} is waiting for you at ${hubName || "your learning hub"}. Bring your order number when you come.`],
  }),
  dispatched: (order) => ({
    tone: "info", icon: "refresh", eyebrow: "On its way",
    heading: `Your order is on its way`,
    paragraphs: [`Order ${order.orderNumber} has been sent to ${[order.deliveryAddress, order.deliveryTown].filter(Boolean).join(", ")}.`],
  }),
  cancelled: (order) => ({
    tone: "warning", icon: "alert", eyebrow: "Order cancelled",
    heading: `Order ${order.orderNumber} was cancelled`,
    paragraphs: ["If you've already paid, we'll be in touch about your refund. Reply to this email with any questions."],
  }),
};

// A status a family should hear about. `note` is staff's own message (tracking details, say).
function sendOrderStatusEmail({ order, status, note, hubName }) {
  const copy = STATUS_COPY[status]?.(order, hubName);
  if (!copy) return Promise.resolve(null);
  const { html, text } = renderEmail({
    ...copy,
    greeting: `Hi ${firstName(order.customerName)},`,
    paragraphs: [...copy.paragraphs, note ? `Note from our team: ${note}` : null].filter(Boolean),
  });
  return queueMail({ to: order.customerEmail, subject: `${copy.heading} — ${order.orderNumber}`, html, text, template: `store_order_${status}`, dedupeKey: `store_order_${status}:${order.id}` });
}

module.exports = { sendOrderPlacedEmail, sendOrderStatusEmail, websiteBase };
