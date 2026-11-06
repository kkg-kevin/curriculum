// Affiliate marketing — the rules, kept pure (tested in test/affiliates.test.js). The service
// (affiliate.service.js) loads and saves; everything it decides comes from here.

const PROGRAMMES = ["home_learning", "tech_club", "pathway", "bootcamp", "shop"];
const PROGRAMME_LABEL = {
  home_learning: "Home Learning",
  tech_club: "Tech Club",
  pathway: "Pathway",
  bootcamp: "Bootcamp",
  shop: "Shop order",
};
// Programmes billed every period (a commission per paid period, up to `periods`); the others are
// paid once.
const RECURRING = new Set(["home_learning", "tech_club", "pathway"]);
const PAYOUT_METHODS = ["credit", "mpesa", "bank", "cash"];

const DEFAULT_SETTINGS = {
  enabled: true,
  // Which programmes earn, and the share of what the family pays (percent).
  programmes: Object.fromEntries(PROGRAMMES.map((p) => [p, true])),
  rates: Object.fromEntries(PROGRAMMES.map((p) => [p, 10])),
  // How many paid periods of a subscription earn (one-off programmes always earn once).
  periods: 3,
  // Days a commission waits after the payment before it can be paid out (refunds, mistakes).
  holdDays: 14,
  // The smallest payout an affiliate can ask for (KSh).
  minimumPayout: 500,
  // How long a link (?ref=) counts after the visit.
  attributionDays: 30,
  // Parents and educators can join from their portal ("Refer & earn"); with approval on, an
  // admin approves them first.
  selfJoin: true,
  requireApproval: true,
  // People who aren't users can apply on the website ("Become an affiliate"); an admin approves.
  publicApplications: true,
  // Affiliates without a login are emailed (a family signed up, they earned, they were paid),
  // each email carrying their private dashboard link.
  emailOutsiders: true,
};

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clamp = (n, min, max, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
};

function normaliseSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const programmes = {};
  const rates = {};
  for (const p of PROGRAMMES) {
    programmes[p] = s.programmes?.[p] === undefined ? DEFAULT_SETTINGS.programmes[p] : Boolean(s.programmes[p]);
    rates[p] = Math.round(clamp(s.rates?.[p], 0, 100, DEFAULT_SETTINGS.rates[p]) * 100) / 100;
  }
  return {
    enabled: s.enabled === undefined ? DEFAULT_SETTINGS.enabled : Boolean(s.enabled),
    programmes,
    rates,
    periods: Math.round(clamp(s.periods, 1, 60, DEFAULT_SETTINGS.periods)),
    holdDays: Math.round(clamp(s.holdDays, 0, 180, DEFAULT_SETTINGS.holdDays)),
    minimumPayout: money(clamp(s.minimumPayout, 0, 1e7, DEFAULT_SETTINGS.minimumPayout)),
    attributionDays: Math.round(clamp(s.attributionDays, 1, 365, DEFAULT_SETTINGS.attributionDays)),
    selfJoin: s.selfJoin === undefined ? DEFAULT_SETTINGS.selfJoin : Boolean(s.selfJoin),
    requireApproval: s.requireApproval === undefined ? DEFAULT_SETTINGS.requireApproval : Boolean(s.requireApproval),
    publicApplications: s.publicApplications === undefined ? DEFAULT_SETTINGS.publicApplications : Boolean(s.publicApplications),
    emailOutsiders: s.emailOutsiders === undefined ? DEFAULT_SETTINGS.emailOutsiders : Boolean(s.emailOutsiders),
  };
}

// Codes are letters and digits, upper case, 4–20 long: "amina-24 " → "AMINA24".
function normaliseCode(value) {
  const code = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 4 && code.length <= 20 ? code : null;
}

// A code from a name: the first name (letters only, up to 8) and two digits — "Amina Wanjiru" →
// "AMINA47". `random` is injectable for tests.
function suggestCode(name, random = Math.random) {
  const base = String(name || "").trim().split(/\s+/)[0].toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "").slice(0, 8) || "FRIEND";
  return `${base.padEnd(4, "X")}${Math.floor(10 + random() * 90)}`;
}

// Phone numbers compared by their last 9 digits (0712…, +254712…, 254712… are one number).
const phoneKey = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
};
const emailKey = (email) => (String(email || "").trim().toLowerCase() || null);

// Which affiliate a sign-up is credited to: a code typed at sign-up wins, else the link the family
// came in by (?ref= kept by the website with the visit, if it's within the attribution days).
// → { code, via } or null.
function pickAttribution({ typedCode, visitSource, attributionDays = DEFAULT_SETTINGS.attributionDays, now = new Date() }) {
  const typed = normaliseCode(typedCode);
  if (typed) return { code: typed, via: "code" };
  const linked = normaliseCode(visitSource?.ref);
  if (!linked) return null;
  const at = visitSource?.refAt ? Date.parse(visitSource.refAt) : NaN;
  if (Number.isFinite(at) && now.getTime() - at > attributionDays * 864e5) return null;
  return { code: linked, via: "link" };
}

// Is the family the affiliate themself (their own login, email or phone)?
function isSelfReferral(affiliate, parent) {
  if (!affiliate || !parent) return false;
  if (affiliate.userId && parent.userId && affiliate.userId === parent.userId) return true;
  const ae = emailKey(affiliate.email);
  if (ae && ae === emailKey(parent.email)) return true;
  const ap = phoneKey(affiliate.phone) || phoneKey(affiliate.payoutPhone);
  return Boolean(ap && ap === phoneKey(parent.phone));
}

// The commission a paid invoice earns, or null when it earns nothing: the programme is switched
// off, the referral has already earned its periods, or there's nothing paid in money (credit
// paid out to an affiliate never earns another commission). `earnedSoFar` = commissions already
// made for this referral (cancelled ones not counted).
function commissionFor({ settings, programme, paidAmount, earnedSoFar }) {
  const s = normaliseSettings(settings);
  if (!s.enabled || !s.programmes[programme]) return null;
  const allowed = RECURRING.has(programme) ? s.periods : 1;
  if (earnedSoFar >= allowed) return null;
  const rate = s.rates[programme];
  const amount = money((money(paidAmount) * rate) / 100);
  if (!(amount > 0)) return null;
  return { periodNumber: earnedSoFar + 1, baseAmount: money(paidAmount), ratePercent: rate, amount };
}

// When a commission can be paid out.
// Whole seconds (MySQL rounds a stored time to the nearest second, which could put it a moment
// after the payment instead of on it).
const availableFrom = (paidAt, holdDays) => new Date(Math.floor((new Date(paidAt).getTime() + Math.max(0, holdDays) * 864e5) / 1000) * 1000);

// A commission's state as people read it: waiting (held), available, in a payout, paid, cancelled.
function commissionState(c, payout = null, now = new Date()) {
  if (c.status === "cancelled") return "cancelled";
  if (c.status === "paid") return "paid";
  if (c.payoutId && payout?.status === "requested") return "requested";
  return new Date(c.availableAt) <= now ? "available" : "waiting";
}

// An affiliate's totals from their commissions (each with `state` from commissionState).
function totals(commissions) {
  const t = { earned: 0, waiting: 0, available: 0, requested: 0, paid: 0 };
  for (const c of commissions) {
    if (c.state === "cancelled") continue;
    t.earned = money(t.earned + Number(c.amount));
    if (t[c.state] !== undefined) t[c.state] = money(t[c.state] + Number(c.amount));
  }
  return t;
}

// What the affiliate may see of a family: the first name only.
const firstNameOf = (name) => String(name || "").trim().split(/\s+/)[0] || "A family";

module.exports = {
  PROGRAMMES, PROGRAMME_LABEL, RECURRING, PAYOUT_METHODS, DEFAULT_SETTINGS,
  normaliseSettings, normaliseCode, suggestCode, phoneKey, emailKey, pickAttribution, isSelfReferral,
  commissionFor, availableFrom, commissionState, totals, firstNameOf, money,
};
