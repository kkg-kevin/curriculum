// Short, plain templates for the two email touchpoints leads trigger. Kept deliberately simple
// (no HTML layout framework) — these are transactional notices, not marketing mail. Every
// sendMail() call goes through shared/utils/mailer.js, which no-ops when SMTP isn't configured,
// so nothing here needs to guard against a missing provider itself.
const { sendMail } = require("../../shared/utils/mailer");

const ACK_SUBJECT = {
  enroll: "We got your enrolment interest — Digifunzi",
  contact: "We got your message — Digifunzi",
};

function ackBody(lead) {
  const greeting = `Hi ${lead.name},`;
  const body =
    lead.source === "enroll"
      ? `Thanks for your interest${lead.learnerName ? ` in a programme for ${lead.learnerName}` : ""}. Our team will review your enquiry and get back to you shortly to arrange next steps.`
      : `Thanks for reaching out. We've received your message and will reply within one working day.`;
  const text = `${greeting}\n\n${body}\n\n— The Digifunzi team`;
  const html = `<p>${greeting}</p><p>${body}</p><p>— The Digifunzi team</p>`;
  return { text, html };
}

// Fire-and-forget auto-acknowledgement to the enquirer, sent right after their lead is stored.
// Never throws — a failed/skipped send must not affect the public POST that triggered it.
async function sendLeadAcknowledgement(lead) {
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
async function sendLeadReply(lead, { subject, body }) {
  const html = `<p>${String(body).replace(/\n/g, "<br/>")}</p>`;
  return sendMail({
    to: lead.email,
    subject: subject || `Re: your enquiry — Digifunzi`,
    text: body,
    html,
  });
}

module.exports = { sendLeadAcknowledgement, sendLeadReply };
