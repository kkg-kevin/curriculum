// Billing emails: "you have a new invoice" and "we received your payment". Each carries a
// summary and a link to the document in the payer's portal (the PDF itself is drawn in the
// browser, so there's nothing to attach from here). Sent through the email outbox, which never
// throws — callers fire these and move on.
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail, appUrl } = require("../../shared/mail/mail.layout");
const { MAIL_BRAND_NAME } = require("../../config/env");
const { adminOfHub, workspaceAllows } = require("../notifications/email-workspace");

// An admin can switch the automatic invoice and receipt emails off for their workspace
// (Settings → Emails). The workspace is the one that owns the invoice's hub.
const workspaceSends = async (invoice, type) => workspaceAllows(await adminOfHub(invoice.hubId), type);

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
const formatMoney = (amount, currency) => `${currency || "KES"} ${Number(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);

// A hub paying its own subscription opens the invoice in the school portal; everyone else billed
// (a parent/guardian) opens it in the learner portal.
const portalBase = (invoice) => (invoice.payerHubId ? "/school-portal/billing" : "/learner-portal");
const invoiceUrl = (invoice) => appUrl(invoice.payerHubId ? `${portalBase(invoice)}/${invoice.id}` : `${portalBase(invoice)}/invoices/${invoice.id}`);
const receiptUrl = (invoice, paymentId) => appUrl(`${portalBase(invoice)}/receipts/${invoice.id}/${paymentId}`);

// A hub's invoice arrives as "Sunrise Hub via Digifunzi", with replies going to the hub.
function sender(invoice) {
  const fromHub = invoice.issuerType === "learning_hub" && invoice.issuedBy?.name;
  return {
    issuerName: fromHub ? invoice.issuedBy.name : MAIL_BRAND_NAME,
    fromName: fromHub ? `${invoice.issuedBy.name} via ${MAIL_BRAND_NAME}` : undefined,
    replyTo: fromHub ? invoice.issuedBy.email || undefined : undefined,
  };
}

const learnerName = (invoice) => (invoice.learner ? `${invoice.learner.firstName} ${invoice.learner.lastName}`.trim() : null);

// `invoice` is the decorated document (BillingService.getInvoiceDocument) — billTo/issuedBy/
// learner/amountDue already resolved. `manual` is a staff member pressing "Email invoice": always
// sends (no dedupe, and whatever the workspace's email settings say) and waits, so the outcome
// can be shown. Returns the outbox row, or null when the payer has no email address on file or
// the workspace has automatic invoice emails switched off.
async function sendInvoiceEmail(invoice, { manual = false } = {}) {
  const to = invoice.billTo?.email;
  if (!to) return null;
  if (!manual && !(await workspaceSends(invoice, "invoice_issued"))) return null;
  const { issuerName, fromName, replyTo } = sender(invoice);
  const due = formatDate(invoice.dueAt);
  const settled = Number(invoice.amountDue) <= 0;
  const { html, text } = renderEmail({
    heading: `Invoice ${invoice.invoiceNumber}`,
    greeting: `Hi ${firstName(invoice.billTo.name)},`,
    paragraphs: [
      settled
        ? `Here is invoice ${invoice.invoiceNumber} from ${issuerName}. It has been paid in full — nothing further is due.`
        : `${issuerName} has issued invoice ${invoice.invoiceNumber}. ${formatMoney(invoice.amountDue, invoice.currency)} is due${due ? ` by ${due}` : ""}.`,
    ],
    rows: [
      ["Invoice", invoice.invoiceNumber],
      ...(learnerName(invoice) ? [["Learner", learnerName(invoice)]] : []),
      ...(invoice.periodLabel ? [["Period", invoice.periodLabel]] : []),
      ["Total", formatMoney(invoice.total, invoice.currency)],
      ["Amount due", formatMoney(invoice.amountDue, invoice.currency)],
      ...(due ? [["Due date", due]] : []),
    ],
    button: { label: "View invoice", url: invoiceUrl(invoice) },
    afterParagraphs: ["Sign in to see the full invoice, print it or download it as a PDF."],
    footerNote: `You're receiving this email because ${issuerName} has this address on file for billing.`,
  });
  return queueMail({
    to, subject: `Invoice ${invoice.invoiceNumber} from ${issuerName}`, html, text, fromName, replyTo,
    template: "invoice_issued", userId: invoice.payerUserId || null,
    dedupeKey: manual ? null : `invoice_issued:${invoice.id}`, wait: manual,
  });
}

async function sendPaymentReceiptEmail(invoice, payment) {
  const to = invoice.billTo?.email;
  if (!to) return null;
  if (!(await workspaceSends(invoice, "payment_receipt"))) return null;
  const { issuerName, fromName, replyTo } = sender(invoice);
  const settled = Number(invoice.amountDue) <= 0;
  const { html, text } = renderEmail({
    heading: "Payment received",
    greeting: `Hi ${firstName(invoice.billTo.name)},`,
    paragraphs: [
      `${issuerName} has recorded your payment of ${formatMoney(payment.amount, invoice.currency)} towards invoice ${invoice.invoiceNumber}. Thank you.`,
      settled ? "This invoice is now paid in full." : `${formatMoney(invoice.amountDue, invoice.currency)} is still outstanding on this invoice.`,
    ],
    rows: [
      ...(payment.receiptNumber ? [["Receipt", payment.receiptNumber]] : []),
      ["Invoice", invoice.invoiceNumber],
      ["Amount paid", formatMoney(payment.amount, invoice.currency)],
      ["Paid on", formatDate(payment.paidAt || payment.paymentDate || new Date())],
      ["Balance", formatMoney(invoice.amountDue, invoice.currency)],
    ],
    button: { label: "View receipt", url: receiptUrl(invoice, payment.id) },
    footerNote: `You're receiving this email because ${issuerName} has this address on file for billing.`,
  });
  return queueMail({
    to, subject: `Payment received — ${payment.receiptNumber || invoice.invoiceNumber}`, html, text, fromName, replyTo,
    template: "payment_receipt", userId: invoice.payerUserId || null, dedupeKey: `payment_receipt:${payment.id}`,
  });
}

module.exports = { sendInvoiceEmail, sendPaymentReceiptEmail };
