// Family credits — the rules that need no database (tested in test/family-credits.test.js).
// 1 credit = KSh 1. A parent buys them; any of their children may spend them on a mentor session
// from their own login (unless the parent has switched that child off or set a monthly limit),
// and the parent may spend them too. Credits never expire and are never paid back as money — a
// cancelled booking's credits go back into the wallet.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const DEFAULTS = { creditsEnabled: true, childBooking: true, minimumPurchase: 100, maximumPurchase: 200000, creditPresets: [500, 1000, 2000, 5000] };

// The credits part of the workspace's mentor booking settings (Settings → Educator Pay → Mentor
// bookings), cleaned.
function cleanCreditSettings(src = {}) {
  const whole = (v, min, max, fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const minimumPurchase = whole(src.minimumPurchase, 1, 100000, DEFAULTS.minimumPurchase);
  const presets = [...new Set((Array.isArray(src.creditPresets) ? src.creditPresets : DEFAULTS.creditPresets)
    .map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n >= minimumPurchase && n <= DEFAULTS.maximumPurchase))]
    .sort((a, b) => a - b).slice(0, 6);
  return {
    creditsEnabled: src.creditsEnabled === undefined ? DEFAULTS.creditsEnabled : !!src.creditsEnabled,
    childBooking: src.childBooking === undefined ? DEFAULTS.childBooking : !!src.childBooking,
    minimumPurchase,
    creditPresets: presets,
  };
}

// Why this purchase can't be made, or null.
function purchaseProblem(amount, settings) {
  const n = Number(amount);
  if (!settings.creditsEnabled) return "Credits aren't on at this learning centre yet";
  if (!Number.isFinite(n) || n <= 0 || Math.round(n) !== n) return "Choose a whole number of credits";
  if (n < settings.minimumPurchase) return `The least you can buy is ${settings.minimumPurchase.toLocaleString("en-KE")} credits`;
  if (n > DEFAULTS.maximumPurchase) return `The most you can buy at once is ${DEFAULTS.maximumPurchase.toLocaleString("en-KE")} credits`;
  return null;
}

// A child's rule as the parent set it: every child may book unless switched off; no monthly limit
// unless one is set.
function ruleFor(childRules, learnerId) {
  const r = (childRules || {})[learnerId] || {};
  const limit = r.monthlyLimit == null || r.monthlyLimit === "" ? null : Math.max(0, Math.round(Number(r.monthlyLimit)));
  return { allowed: r.allowed !== false, monthlyLimit: Number.isFinite(limit) ? limit : null };
}

// Can this child spend `amount` now? { ok, reason, left } — `spentThisMonth` is what they've spent
// (net of refunds) this Kenyan calendar month; `left` what their monthly limit still allows.
function childSpendCheck({ settings, rule, balance, amount, spentThisMonth = 0 }) {
  const need = round2(amount);
  const left = rule.monthlyLimit == null ? null : Math.max(0, round2(rule.monthlyLimit - spentThisMonth));
  if (!settings.creditsEnabled || !settings.childBooking) return { ok: false, reason: "Booking a mentor yourself isn't on at your learning centre yet — ask your parent to book for you.", left };
  if (!rule.allowed) return { ok: false, reason: "Your parent hasn't switched on booking with credits for you — ask them to book, or to switch it on.", left };
  if (left != null && need > left) return { ok: false, reason: `That's more than you can spend this month (${left.toLocaleString("en-KE")} credits left) — ask your parent.`, left };
  if (need > round2(balance)) return { ok: false, reason: `You need ${need.toLocaleString("en-KE")} credits and there ${round2(balance) === 1 ? "is" : "are"} ${round2(balance).toLocaleString("en-KE")} — ask your parent to add some.`, left };
  return { ok: true, reason: null, left };
}

// How a booking's refund splits: credits go straight back to the wallet, the rest is money due.
function splitRefund(refund, creditsUsed) {
  const total = Math.max(0, round2(refund));
  const credits = Math.min(total, Math.max(0, round2(creditsUsed)));
  return { credits, money: round2(total - credits) };
}

// "2026-11" in Kenya (UTC+3), and that month's first instant.
function kenyaMonthStart(now = new Date()) {
  const k = new Date(now.getTime() + 3 * 3600 * 1000);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - 3 * 3600 * 1000);
}

module.exports = { DEFAULTS, round2, cleanCreditSettings, purchaseProblem, ruleFor, childSpendCheck, splitRefund, kenyaMonthStart };
