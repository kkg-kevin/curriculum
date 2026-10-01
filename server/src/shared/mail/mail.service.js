const env = require("../../config/env");
const { deliver, isConfigured } = require("../utils/mailer");
const EmailOutboxModel = require("./email-outbox.model");

// Account emails (password resets, invoices, receipts, emailed notifications) go through here
// rather than straight to mailer.js: each one is written to email_outbox first and sent from that
// row, so a provider hiccup is retried instead of losing the email.
//
// Delivery happens in this process right after the row is written, one email at a time (a bulk
// invoice run queues hundreds at once — sending them in parallel is what trips provider rate
// limits). Anything that fails is retried with a growing delay, by the next email that gets
// queued and by `npm run mail:process` (meant for a cron job — see scripts/processEmailOutbox.js),
// which also covers a process restart mid-send.
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5 * 60 * 1000;

const scrubbed = (row) => (row.sensitive ? { html: null, text: null } : {});

// Sends one outbox row, if it's still waiting to be sent. Returns the row as it stands after.
async function deliverRow(id) {
  if (!(await EmailOutboxModel.claim(id))) return EmailOutboxModel.findById(id);
  return sendClaimed(await EmailOutboxModel.findById(id));
}

// Sends a row this caller already holds (status "sending") and records the outcome.
async function sendClaimed(row) {
  const id = row.id;

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    await EmailOutboxModel.update(id, { status: "expired", ...scrubbed(row) });
    return EmailOutboxModel.findById(id);
  }

  const result = await deliver({
    to: row.toEmail, subject: row.subject, html: row.html, text: row.text,
    replyTo: row.replyTo, fromName: row.fromName,
  });

  if (result.ok) {
    await EmailOutboxModel.update(id, { status: "sent", sentAt: new Date(), attempts: row.attempts + 1, lastError: null, ...scrubbed(row) });
  } else if (result.skipped) {
    // No mail provider on this environment. Not retried later — configuring SMTP months on
    // shouldn't release a backlog of stale emails. Locally, print the email so a reset link can
    // still be followed without one.
    console.log(`[mail] SMTP not configured — not sent to ${row.toEmail}: "${row.subject}"`);
    if (env.NODE_ENV !== "production" && row.text) console.log(row.text);
    await EmailOutboxModel.update(id, { status: "skipped", lastError: "SMTP not configured", ...scrubbed(row) });
  } else {
    const attempts = row.attempts + 1;
    const dead = attempts >= MAX_ATTEMPTS;
    console.error(`[mail] failed to send "${row.template}" to ${row.toEmail} (attempt ${attempts}):`, result.error);
    await EmailOutboxModel.update(id, {
      status: dead ? "dead" : "failed",
      attempts,
      lastError: String(result.error).slice(0, 500),
      nextAttemptAt: dead ? null : new Date(Date.now() + RETRY_BASE_MS * 2 ** (attempts - 1)),
      ...(dead ? scrubbed(row) : {}),
    });
  }
  return EmailOutboxModel.findById(id);
}

// Sends everything that's due, one at a time. Returns how many rows it handled.
async function processOutbox({ limit = 50 } = {}) {
  let handled = 0;
  while (handled < limit) {
    const due = await EmailOutboxModel.findDue(Math.min(20, limit - handled));
    if (!due.length) break;
    for (const { id } of due) {
      await deliverRow(id);
      handled += 1;
    }
  }
  return handled;
}

let draining = false;
function kick() {
  if (draining) return;
  draining = true;
  setImmediate(async () => {
    try {
      await processOutbox();
    } catch (err) {
      console.error("[mail] outbox run failed:", err.message);
    } finally {
      draining = false;
    }
  });
}

// Queues an email and sends it. Never throws — an email must not fail the request that caused it.
//   template   short name for what this email is ("password_reset", "invoice_issued", ...)
//   dedupeKey  set when the same event may fire twice; the second call returns the first row
//   sensitive  the body is wiped once the email is sent, expires or is given up on
//   expiresAt  don't send after this (a reset link that's no longer valid)
//   wait       resolve only once the send was attempted, so the caller can report the outcome
// Returns the outbox row (status "sent" | "pending" | "failed" | "skipped" | ...), or null when
// there was no address to send to.
async function queueMail({ to, subject, html, text, replyTo, fromName, template, userId, dedupeKey, sensitive = false, expiresAt, wait = false }) {
  if (!to) return null;
  try {
    if (dedupeKey) {
      const existing = await EmailOutboxModel.findByDedupeKey(dedupeKey);
      if (existing) return existing;
    }
    let row;
    try {
      row = await EmailOutboxModel.create({
        toEmail: to, subject: String(subject).slice(0, 255), html, text: text || null,
        replyTo: replyTo || null, fromName: fromName ? String(fromName).slice(0, 150) : null,
        template, userId: userId || null, dedupeKey: dedupeKey || null,
        // A caller that waits sends the row itself, so it's created already claimed — otherwise
        // a run that's in progress could pick it up first and the caller would see "sending".
        status: wait ? "sending" : "pending", attempts: 0, sensitive, expiresAt: expiresAt || null,
      });
    } catch (err) {
      // Two requests raced on the same dedupeKey — the other one's row is the email.
      if (dedupeKey && err.code === "ER_DUP_ENTRY") return EmailOutboxModel.findByDedupeKey(dedupeKey);
      throw err;
    }
    if (wait) return await sendClaimed(row);
    kick();
    return row;
  } catch (err) {
    console.error(`[mail] could not queue "${template}" for ${to}:`, err.message);
    return null;
  }
}

module.exports = { queueMail, processOutbox, isConfigured };
