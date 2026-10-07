// The two email touchpoints leads trigger: the automatic "we got it" to the enquirer, and a staff
// member's reply. Both use the shared email layout (shared/mail/mail.layout.js) and are signed
// with MAIL_BRAND_NAME. Every sendMail() call goes through shared/utils/mailer.js, which no-ops
// when SMTP isn't configured, so nothing here needs to guard against a missing provider itself.
const { sendMail } = require("../../shared/utils/mailer");
const { renderEmail } = require("../../shared/mail/mail.layout");
const { MAIL_BRAND_NAME } = require("../../config/env");

const ACK_SUBJECT = {
  enroll: `We got your enrolment interest — ${MAIL_BRAND_NAME}`,
  contact: `We got your message — ${MAIL_BRAND_NAME}`,
};

function ackBody(lead) {
  const enroll = lead.source === "enroll";
  const body = enroll
    ? `Thanks for your interest${lead.learnerName ? ` in a programme for ${lead.learnerName}` : ""}. Our team will review your enquiry and get back to you shortly to arrange next steps.`
    : `Thanks for reaching out. We've received your message and will reply within one working day.`;
  return renderEmail({
    tone: "success", icon: "check", eyebrow: "Enquiry received",
    heading: enroll ? "We got your enrolment interest" : "We got your message",
    greeting: `Hi ${lead.name},`,
    paragraphs: [body, `— The ${MAIL_BRAND_NAME} team`],
    preview: body,
    footerNote: `You're receiving this email because you contacted ${MAIL_BRAND_NAME} through our website.`,
  });
}

// Fire-and-forget auto-acknowledgement to the enquirer, sent right after their lead is stored.
// Never throws — a failed/skipped send must not affect the public POST that triggered it.
// A "diagnostic"-sourced lead has no email (the diagnostic form asks name + phone only), so
// there's nothing to acknowledge to — skip cleanly.
async function sendLeadAcknowledgement(lead) {
  if (!lead.email) return false;
  const { text, html } = ackBody(lead);
  return sendMail({
    to: lead.email,
    subject: ACK_SUBJECT[lead.source] || ACK_SUBJECT.contact,
    text,
    html,
  });
}

// Staff replying to a lead from the Enquiries page — Reply-To is the shared inbox
// (MAIL_REPLY_TO), so an inbound reply from the enquirer lands there, not back at this system.
// The reply is the staff member's own words: blank lines start a new paragraph, single line
// breaks are kept.
async function sendLeadReply(lead, { subject, body }) {
  const paragraphs = String(body).split(/\r?\n\s*\r?\n/).map((part) => part.trim()).filter(Boolean);
  const { html, text } = renderEmail({
    tone: "brand", icon: "envelope", eyebrow: "Reply to your enquiry",
    heading: subject || "About your enquiry",
    paragraphs,
    footerNote: `You're receiving this email because you sent an enquiry to ${MAIL_BRAND_NAME}.`,
  });
  return sendMail({
    to: lead.email,
    subject: subject || `Re: your enquiry — ${MAIL_BRAND_NAME}`,
    text,
    html,
  });
}

module.exports = { sendLeadAcknowledgement, sendLeadReply };
