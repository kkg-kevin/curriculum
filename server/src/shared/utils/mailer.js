const env = require("../../config/env");

// Thin nodemailer wrapper — optional by design, same pattern as PUBLIC_SITE_URL/API_PUBLIC_URL:
// if SMTP_HOST/SMTP_USER/SMTP_PASS aren't set, every send() silently no-ops (logs and resolves)
// instead of throwing, so nothing that calls this ever needs its own try/catch just to stay
// functional without a mail provider configured. A failed send must never fail the request that
// triggered it (a public lead POST, a status update) — the caller already did its real job.
let transporter = null;
let initAttempted = false;

function getTransporter() {
  if (initAttempted) return transporter;
  initAttempted = true;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  // Lazy require — keeps nodemailer optional at the package level for any environment that
  // never sets SMTP_* at all (nothing above this line touches the module).
  const nodemailer = require("nodemailer");
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

function isConfigured() {
  return !!getTransporter();
}

// `fromName` swaps only the display name ("Sunrise Hub via Digifunzi") — the address stays the
// configured sender, since that's the one the mail domain's SPF/DKIM actually vouches for.
function fromHeader(fromName) {
  const configured = env.MAIL_FROM || env.SMTP_USER;
  if (!fromName) return configured;
  const address = (configured.match(/<([^>]+)>/) || [])[1] || configured;
  return { name: fromName, address: address.trim() };
}

// Same send as sendMail below, but reports what happened instead of collapsing it to a boolean —
// for callers that have to tell "no mail provider configured" apart from "the send failed"
// (the email outbox, see shared/mail/mail.service.js). Never throws.
//   { ok: true } | { ok: false, skipped: true } | { ok: false, error: "<message>" }
async function deliver({ to, subject, html, text, replyTo, fromName }) {
  const t = getTransporter();
  if (!t) return { ok: false, skipped: true };
  try {
    await t.sendMail({
      from: fromHeader(fromName),
      to,
      subject,
      html,
      text: text || undefined,
      replyTo: replyTo || env.MAIL_REPLY_TO || undefined,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Send failed" };
  }
}

// { to, subject, html, text?, replyTo? } — from/replyTo default to MAIL_FROM/MAIL_REPLY_TO.
// Returns true if a send was attempted and succeeded, false if skipped (no-op) or failed —
// callers that only want "best effort" can ignore the return value entirely.
async function sendMail({ to, subject, html, text, replyTo }) {
  const result = await deliver({ to, subject, html, text, replyTo });
  if (result.skipped) console.log(`[mailer] SMTP not configured — skipping email to ${to}: "${subject}"`);
  else if (!result.ok) console.error(`[mailer] failed to send to ${to}:`, result.error);
  return result.ok;
}

module.exports = { sendMail, deliver, isConfigured };
