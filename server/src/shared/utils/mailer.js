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

// Brevo's HTTP API, used instead of SMTP when BREVO_API_KEY is set. Shared hosts commonly redirect
// or block outbound SMTP ports (25/465/587/2525), which shows up as a certificate mismatch or
// ECONNREFUSED; the API goes over 443 like any other web request.
const useApi = () => !!env.BREVO_API_KEY;

function isConfigured() {
  return useApi() || !!getTransporter();
}

// `fromName` swaps only the display name ("Sunrise Hub via Digifunzi") — the address stays the
// configured sender, since that's the one the mail domain's SPF/DKIM actually vouches for.
function fromHeader(fromName) {
  const configured = env.MAIL_FROM || env.SMTP_USER;
  if (!fromName) return configured;
  const address = (configured.match(/<([^>]+)>/) || [])[1] || configured;
  return { name: fromName, address: address.trim() };
}

const addressOf = (value) => ((String(value || "").match(/<([^>]+)>/) || [])[1] || String(value || "")).trim();
const nameOf = (value) => (String(value || "").match(/^\s*"?([^"<]*?)"?\s*</) || [])[1] || "";

function deliverViaApi({ to, subject, html, text, replyTo, fromName }) {
  const configured = env.MAIL_FROM || "";
  const reply = replyTo || env.MAIL_REPLY_TO;
  const body = JSON.stringify({
    sender: { email: addressOf(configured), name: fromName || nameOf(configured) || env.MAIL_BRAND_NAME },
    to: [{ email: addressOf(to) }],
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
    ...(reply ? { replyTo: { email: addressOf(reply) } } : {}),
  });
  return new Promise((resolve) => {
    const req = require("https").request(
      "https://api.brevo.com/v3/smtp/email",
      { method: "POST", timeout: 20000, headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json", "content-length": Buffer.byteLength(body) } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ ok: true });
          let message = data;
          try { message = JSON.parse(data).message || data; } catch { /* not JSON — keep the raw body */ }
          resolve({ ok: false, error: `Brevo API ${res.statusCode}: ${String(message).slice(0, 300)}` });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Brevo API request timed out")));
    req.on("error", (err) => resolve({ ok: false, error: err.message || "Send failed" }));
    req.end(body);
  });
}

// Same send as sendMail below, but reports what happened instead of collapsing it to a boolean —
// for callers that have to tell "no mail provider configured" apart from "the send failed"
// (the email outbox, see shared/mail/mail.service.js). Never throws.
//   { ok: true } | { ok: false, skipped: true } | { ok: false, error: "<message>" }
async function deliver({ to, subject, html, text, replyTo, fromName }) {
  if (useApi()) return deliverViaApi({ to, subject, html, text, replyTo, fromName });
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
