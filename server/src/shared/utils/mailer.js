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

// { to, subject, html, text?, replyTo? } — from/replyTo default to MAIL_FROM/MAIL_REPLY_TO.
// Returns true if a send was attempted and succeeded, false if skipped (no-op) or failed —
// callers that only want "best effort" can ignore the return value entirely.
async function sendMail({ to, subject, html, text, replyTo }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] SMTP not configured — skipping email to ${to}: "${subject}"`);
    return false;
  }
  try {
    await t.sendMail({
      from: env.MAIL_FROM || env.SMTP_USER,
      to,
      subject,
      html,
      text: text || undefined,
      replyTo: replyTo || env.MAIL_REPLY_TO || undefined,
    });
    return true;
  } catch (err) {
    console.error(`[mailer] failed to send to ${to}:`, err.message);
    return false;
  }
}

module.exports = { sendMail };
