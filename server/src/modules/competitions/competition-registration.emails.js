// Competition registration emails (20 Nov 2026), through the outbox (never throws): "we've got
// your registration" with the fee and a link to pay, "you're confirmed" once paid (or straight
// away on a free track), and "cancelled". Sent to the person who registered — no portal login
// exists for them, so links go to the website.
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail } = require("../../shared/mail/mail.layout");
const env = require("../../config/env");

const formatMoney = (amount, currency) => `${currency || "KES"} ${Number(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

function websiteBase() {
  const sites = String(env.PUBLIC_SITE_URL || "").split(",").map((s) => s.trim()).filter(Boolean);
  return (env.MAIL_WEBSITE_URL || sites.find((s) => /^https:\/\//i.test(s)) || sites[0] || "").replace(/\/+$/, "");
}

function entryRows(reg, competitionName) {
  const people = (reg.participants || []).map((p) => p.name).join(", ");
  return [
    ["Competition", competitionName],
    ["Track", reg.trackName],
    ["Entry", reg.entryType === "group" ? `Team "${reg.teamName}" (${reg.participantCount} members)` : "Individual"],
    [reg.entryType === "group" ? "Members" : "Participant", people],
    ["Registration no.", reg.registrationNumber],
  ];
}

// Right after registering, with a fee to pay.
function sendRegistrationReceived({ registration: reg, competitionName, payToken }) {
  const base = websiteBase();
  const payUrl = payToken && base ? `${base}/pay/${encodeURIComponent(payToken)}` : null;
  const { html, text } = renderEmail({
    tone: "info", icon: "document", eyebrow: "Registration received",
    preview: `${formatMoney(reg.amount, reg.currency)} to pay — ${competitionName}`,
    heading: `Thanks for registering, ${firstName(reg.contactName)}`,
    highlight: { label: "Entry fee to pay", value: formatMoney(reg.amount, reg.currency), note: reg.registrationNumber },
    rows: entryRows(reg, competitionName),
    paragraphs: [
      `We've got your registration for ${competitionName}. It's confirmed as soon as the entry fee is paid — pay using any of the options on the payment page and tell us once you have.`,
    ],
    button: payUrl ? { label: "Pay the entry fee", url: payUrl } : undefined,
    afterParagraphs: payUrl ? ["The payment link works for 14 days. After that, reply to this email and we'll help."] : [],
  });
  return queueMail({ to: reg.contactEmail, subject: `${competitionName} — registration ${reg.registrationNumber}`, html, text, template: "competition_registration_received", dedupeKey: `competition_registration_received:${reg.id}` });
}

// Paid in full, or a free track: they're in.
function sendRegistrationConfirmed({ registration: reg, competitionName }) {
  const { html, text } = renderEmail({
    tone: "success", icon: "check", eyebrow: "You're registered",
    preview: `${reg.entryType === "group" ? `Team ${reg.teamName}` : reg.participants?.[0]?.name} is registered for ${competitionName}`,
    heading: reg.entryType === "group" ? `Team ${reg.teamName} is registered` : `${firstName(reg.participants?.[0]?.name)} is registered`,
    greeting: `Hi ${firstName(reg.contactName)},`,
    rows: entryRows(reg, competitionName),
    paragraphs: [
      `Your entry for ${competitionName} — ${reg.trackName} is confirmed. We'll be in touch with everything you need before it starts.`,
      "Keep your registration number handy — quote it whenever you contact us.",
    ],
  });
  return queueMail({ to: reg.contactEmail, subject: `Confirmed: ${competitionName} — ${reg.trackName}`, html, text, template: "competition_registration_confirmed", dedupeKey: `competition_registration_confirmed:${reg.id}` });
}

function sendRegistrationCancelled({ registration: reg, competitionName, reason }) {
  const { html, text } = renderEmail({
    tone: "warning", icon: "alert", eyebrow: "Registration cancelled",
    heading: `Registration ${reg.registrationNumber} was cancelled`,
    greeting: `Hi ${firstName(reg.contactName)},`,
    rows: entryRows(reg, competitionName),
    paragraphs: [
      `Your registration for ${competitionName} — ${reg.trackName} has been cancelled.`,
      reason ? `Note from our team: ${reason}` : null,
      "If you've already paid, we'll be in touch about it. Reply to this email with any questions.",
    ].filter(Boolean),
  });
  return queueMail({ to: reg.contactEmail, subject: `Cancelled: ${competitionName} — ${reg.registrationNumber}`, html, text, template: "competition_registration_cancelled", dedupeKey: `competition_registration_cancelled:${reg.id}` });
}

module.exports = { sendRegistrationReceived, sendRegistrationConfirmed, sendRegistrationCancelled };
