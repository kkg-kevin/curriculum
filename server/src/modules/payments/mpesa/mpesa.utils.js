// Small, pure helpers for M-Pesa — no database, no network — so they can be tested on their own
// (test/mpesa.test.js).

// A Kenyan mobile number in the form Daraja wants: 2547XXXXXXXX or 2541XXXXXXXX. Accepts the
// ways people write it (0712 345 678, +254712345678, 712345678, 254-712-345678). Null when it
// isn't a Kenyan mobile number.
function normalisePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) digits = `254${digits.slice(1)}`;
  else if (digits.length === 9 && /^[17]/.test(digits)) digits = `254${digits}`;
  return /^254[17]\d{8}$/.test(digits) ? digits : null;
}

// 254712345678 → 2547****5678, for lists staff see. Safaricom already sends a hashed number for
// Paybill payments; that's shortened instead.
function maskPhone(value) {
  const text = String(value || "");
  if (/^\d{12}$/.test(text)) return `${text.slice(0, 4)}****${text.slice(-4)}`;
  if (text.length > 16) return `${text.slice(0, 6)}…`;
  return text || null;
}

// Daraja's timestamps are Kenyan time (EAT, UTC+3, no daylight saving) as YYYYMMDDHHmmss,
// whatever time zone the server runs in.
function darajaTimestamp(date = new Date()) {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${eat.getUTCFullYear()}${pad(eat.getUTCMonth() + 1)}${pad(eat.getUTCDate())}${pad(eat.getUTCHours())}${pad(eat.getUTCMinutes())}${pad(eat.getUTCSeconds())}`;
}

// The reverse: "20261021143005" (EAT) → a Date. Null when it isn't one.
function parseDarajaTimestamp(value) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h - 3, mi, s));
  return Number.isNaN(date.getTime()) ? null : date;
}

// The STK Push password: base64(shortcode + passkey + timestamp).
function stkPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

// An invoice's payment code — what a payer types as the Paybill "Account": the invoice number
// without its prefix and dashes (INV-2026-000123 → 2026000123). STK's AccountReference is capped
// at 12 characters, so the full number doesn't fit. Null for an invoice that has no real number
// yet (a draft).
function paymentCodeFor(invoiceNumber) {
  const match = /^INV-(\d{4})-(\d+)$/.exec(String(invoiceNumber || ""));
  return match ? `${match[1]}${match[2]}` : null;
}

// What a payer typed as the Paybill account → the invoice number it most likely means, or null.
// Forgiving on purpose: case, spaces, dashes, an "INV" prefix and dropped leading zeros are all
// fine — "inv-2026-000123", "2026 000123" and "2026123" all mean INV-2026-000123.
function invoiceNumberFromAccount(account) {
  const text = String(account || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^INV/, "");
  const match = /^(20\d{2})(\d{1,9})$/.exec(text);
  if (!match) return null;
  const sequence = Number(match[2]);
  if (!sequence) return null;
  return `INV-${match[1]}-${String(sequence).padStart(6, "0")}`;
}

// The value of one item in an STK callback's CallbackMetadata.Item list.
function callbackItem(items, name) {
  const item = (Array.isArray(items) ? items : []).find((i) => i?.Name === name);
  return item ? item.Value : undefined;
}

// A result-URL callback's ResultParameters (B2C, Transaction Status, Reversal) → a plain object.
// Safaricom sends one parameter as an object rather than a list of one.
function resultParameters(result) {
  const list = result?.ResultParameters?.ResultParameter;
  const items = Array.isArray(list) ? list : list ? [list] : [];
  return Object.fromEntries(items.filter((p) => p && p.Key).map((p) => [p.Key, p.Value]));
}

// An STK result code → what became of the prompt, and what to tell the payer.
const STK_RESULTS = {
  0: { status: "successful", message: "Payment received." },
  1: { status: "failed", message: "There wasn't enough money in the M-Pesa account." },
  1001: { status: "failed", message: "Another M-Pesa payment was in progress on that phone. Wait a moment and try again." },
  1019: { status: "timeout", message: "The prompt expired before it was answered." },
  1025: { status: "failed", message: "M-Pesa couldn't send the prompt. Try again." },
  1032: { status: "cancelled", message: "The payment was cancelled on the phone." },
  1037: { status: "timeout", message: "The phone couldn't be reached, or the prompt wasn't answered in time." },
  2001: { status: "failed", message: "The M-Pesa PIN was wrong." },
  9999: { status: "failed", message: "M-Pesa couldn't send the prompt. Try again." },
};

function describeStkResult(code) {
  const known = STK_RESULTS[Number(code)];
  return known || { status: "failed", message: "M-Pesa didn't complete the payment." };
}

// Whole shillings only: M-Pesa can't take cents. Rounded up, so paying "what's due" always covers it.
function wholeShillings(amount) {
  return Math.max(0, Math.ceil(Number(amount || 0) - 1e-9));
}

module.exports = {
  normalisePhone,
  maskPhone,
  darajaTimestamp,
  parseDarajaTimestamp,
  stkPassword,
  paymentCodeFor,
  invoiceNumberFromAccount,
  callbackItem,
  resultParameters,
  describeStkResult,
  wholeShillings,
};
