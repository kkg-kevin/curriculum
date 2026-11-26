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
  // Affiliates who sign in as Affiliate (not a parent or educator here) are also emailed when a
  // family signs up, they earn or a payout is decided, each email with a button to their account.
  emailOutsiders: true,
  // Teams (12 Nov 2026): a manager (level 1) earns a share on top of what the affiliates under them
  // earn — `teamRate` percent of what the family paid ("payment") or of the affiliate's own
  // commission ("commission"). Never taken out of the affiliate's commission.
  teamRate: 2,
  teamBasis: "payment",
  // Prospects (19 Nov 2026): families an affiliate pre-registers are claimed for them for
  // `claimDays`; a sign-up matching the parent's phone or email is theirs even without a code.
  // `claimOrder`: "code_first" — a code the family types wins, then a prospect claim, then a link;
  // "prospect_first" — the claim wins even over a typed code. At most `prospectDailyLimit` a day.
  prospectsEnabled: true,
  claimDays: 60,
  claimOrder: "code_first",
  prospectDailyLimit: 30,
  // Monthly targets (25 Nov 2026 — affiliate.targets.js), for every affiliate unless they have
  // their own: money = what the families they brought in paid in the month (KSh); families =
  // families whose first invoice was paid in full in the month. 0 = no target. Tracking only.
  // `targetNotices`: the bell at halfway and on reaching each target.
  targetMoney: 0,
  targetFamilies: 0,
  targetNotices: true,
};
const CLAIM_ORDERS = ["code_first", "prospect_first"];
const TEAM_BASES = ["payment", "commission"];

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
    teamRate: Math.round(clamp(s.teamRate, 0, 100, DEFAULT_SETTINGS.teamRate) * 100) / 100,
    teamBasis: TEAM_BASES.includes(s.teamBasis) ? s.teamBasis : DEFAULT_SETTINGS.teamBasis,
    prospectsEnabled: s.prospectsEnabled === undefined ? DEFAULT_SETTINGS.prospectsEnabled : Boolean(s.prospectsEnabled),
    claimDays: Math.round(clamp(s.claimDays, 1, 365, DEFAULT_SETTINGS.claimDays)),
    claimOrder: CLAIM_ORDERS.includes(s.claimOrder) ? s.claimOrder : DEFAULT_SETTINGS.claimOrder,
    prospectDailyLimit: Math.round(clamp(s.prospectDailyLimit, 1, 1000, DEFAULT_SETTINGS.prospectDailyLimit)),
    targetMoney: money(clamp(s.targetMoney, 0, 1e9, DEFAULT_SETTINGS.targetMoney)),
    targetFamilies: Math.round(clamp(s.targetFamilies, 0, 100000, DEFAULT_SETTINGS.targetFamilies)),
    targetNotices: s.targetNotices === undefined ? DEFAULT_SETTINGS.targetNotices : Boolean(s.targetNotices),
  };
}

// An affiliate's own deal (affiliates.customRates), cleaned: only what's set is kept — a rate per
// programme, the number of paid periods, and (a manager's) team rate. null = Settings for all.
function normaliseCustomRates(raw) {
  const r = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!r || typeof r !== "object") return null;
  const out = {};
  const rates = {};
  for (const p of PROGRAMMES) {
    const v = r.rates?.[p];
    if (v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v))) rates[p] = Math.round(clamp(v, 0, 100, 0) * 100) / 100;
  }
  if (Object.keys(rates).length) out.rates = rates;
  if (r.periods !== undefined && r.periods !== null && r.periods !== "" && Number.isFinite(Number(r.periods))) out.periods = Math.round(clamp(r.periods, 1, 60, 1));
  if (r.teamRate !== undefined && r.teamRate !== null && r.teamRate !== "" && Number.isFinite(Number(r.teamRate))) out.teamRate = Math.round(clamp(r.teamRate, 0, 100, 0) * 100) / 100;
  return Object.keys(out).length ? out : null;
}

// The settings as they apply to one affiliate: the workspace's, with their own deal on top.
function effectiveSettings(settings, affiliate = null) {
  const s = normaliseSettings(settings);
  const custom = normaliseCustomRates(affiliate?.customRates);
  if (!custom) return s;
  return {
    ...s,
    rates: { ...s.rates, ...(custom.rates || {}) },
    periods: custom.periods ?? s.periods,
    teamRate: custom.teamRate ?? s.teamRate,
  };
}

// A manager's share of one of their team's commissions, or null. `own` is the commission the
// affiliate under them just earned ({ baseAmount, amount, periodNumber }); `manager` their manager.
function teamShareFor({ settings, manager, own }) {
  if (!manager || !own) return null;
  const s = effectiveSettings(settings, manager);
  const rate = s.teamRate;
  if (!(rate > 0)) return null;
  const base = s.teamBasis === "commission" ? money(own.amount) : money(own.baseAmount);
  const amount = money((base * rate) / 100);
  if (!(amount > 0)) return null;
  return { periodNumber: own.periodNumber, baseAmount: base, ratePercent: rate, amount };
}

// Who may be under whom: two levels only. Returns a problem in words, or null.
function teamProblem({ affiliate, isManager, managerId, manager, teamSize = 0 }) {
  if (isManager && managerId) return "A manager can't be under another manager.";
  if (!isManager && affiliate?.isManager && teamSize > 0) return `They manage ${teamSize} ${teamSize === 1 ? "affiliate" : "affiliates"} — move them to another manager (or on their own) first.`;
  if (managerId) {
    if (affiliate && managerId === affiliate.id) return "An affiliate can't be their own manager.";
    if (!manager) return "That manager wasn't found.";
    if (!manager.isManager) return `${manager.name} isn't a manager.`;
    if (manager.managerId) return `${manager.name} is under a manager themselves.`;
  }
  return null;
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

// A person's name for matching: lower case, letters and single spaces only ("Mary  Wanjiku-Otieno"
// → "mary wanjiku otieno").
const nameKey = (name) => String(name || "").toLowerCase().replace(/[^a-zÀ-ɏ]+/g, " ").trim() || null;

// Who a sign-up is credited to, from the candidates found valid (an active affiliate of the
// workspace, not the family themself): the code the family typed, an open prospect claim on their
// phone or email, a link they came by. The workspace's `claimOrder` decides between a typed code
// and a claim; a link always comes last. → { via, value } or null.
function chooseClaim({ typed = null, prospect = null, link = null, order = "code_first" }) {
  const seq = order === "prospect_first" ? ["prospect", "code", "link"] : ["code", "prospect", "link"];
  const found = { code: typed, prospect, link };
  for (const via of seq) if (found[via]) return { via, value: found[via] };
  return null;
}

// What a claim looks like from the affiliate's side, from its status and dates: open (and days
// left), signed up, paying, lost, expired, released, opted out.
function prospectState(p, referral = null, today = new Date()) {
  // Our team's own family (26 Nov 2026): no affiliate, no claim clock.
  if (p.status === "open" && !p.affiliateId) return { key: "open", label: "Ours · not signed up yet", team: true };
  if (p.status === "open" && new Date(p.expiresAt) < today) return { key: "expired", label: "Claim ended" };
  if (p.status === "open") {
    const days = Math.max(0, Math.ceil((new Date(p.expiresAt) - today) / 864e5));
    return { key: "open", label: "Waiting to sign up", daysLeft: days };
  }
  if (p.status === "signed_up") return referral?.status === "paid" ? { key: "paying", label: "Paying" } : referral?.status === "cancelled" ? { key: "cancelled", label: "Cancelled" } : { key: "signed_up", label: "Signed up" };
  return {
    lost: { key: "lost", label: "Signed up with another code" },
    expired: { key: "expired", label: "Claim ended" },
    released: { key: "released", label: "Released" },
    opted_out: { key: "opted_out", label: "Asked not to be contacted" },
  }[p.status] || { key: p.status, label: p.status };
}

// Where the conversation with a prospect stands (26 Nov 2026) — set by the affiliate or our team,
// apart from "signed_up", which comes from the sign-up itself. Order = the usual path.
const PROSPECT_STAGES = [
  { key: "new", label: "New", hint: "Not contacted yet" },
  { key: "contacted", label: "Contacted", hint: "We've talked to them" },
  { key: "no_answer", label: "Couldn't reach", hint: "No answer yet, try again" },
  { key: "interested", label: "Interested", hint: "Keen, still deciding" },
  { key: "visit_booked", label: "Visit or trial booked", hint: "Coming to see a class or a hub" },
  { key: "later", label: "Maybe later", hint: "Not now, ask again later" },
  { key: "not_interested", label: "Not interested", hint: "Said no" },
  { key: "signed_up", label: "Signed up", hint: "Signed up on the website", auto: true },
];
const STAGE_KEYS = PROSPECT_STAGES.map((s) => s.key);
const SETTABLE_STAGES = PROSPECT_STAGES.filter((s) => !s.auto).map((s) => s.key);
// A prospect's stage: "signed_up" once they have, else what was last set ("new" by default).
function stageOf(p) {
  if (p?.status === "signed_up") return PROSPECT_STAGES.find((s) => s.key === "signed_up");
  return PROSPECT_STAGES.find((s) => s.key === p?.stage) || PROSPECT_STAGES[0];
}
// Why a stage can't be set now, or null.
function stageProblem(p, stage) {
  if (!SETTABLE_STAGES.includes(stage)) return "Choose a status";
  if (p.status === "signed_up") return "They've signed up already";
  if (p.status !== "open") return "This claim has closed";
  return null;
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

// Where an affiliate's own Refer & earn is: their educator or parent portal, else the affiliate portal.
const portalRouteOf = (affiliate) => (affiliate?.kind === "educator" ? "/teacher-portal/refer" : affiliate?.kind === "parent" ? "/parent/refer" : "/affiliate-portal");

// ---- Targets (25 Nov 2026) ------------------------------------------------------------------------
// Monthly, on the Kenyan calendar (EAT, UTC+3). A month is "YYYY-MM".
const KENYA_MS = 3 * 60 * 60 * 1000;
const pad2 = (n) => String(n).padStart(2, "0");
const isMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ""));
function monthOf(date = new Date()) {
  const d = new Date(new Date(date).getTime() + KENYA_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}
function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}
// The month as instants: from Kenyan midnight on the 1st up to (not including) the next month's.
function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1) - KENYA_MS), to: new Date(Date.UTC(y, m, 1) - KENYA_MS) };
}
const daysInMonth = (month) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const monthLabel = (month) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); };
// Days left in the month, today included (0 once it's over).
function daysLeftIn(month, today = new Date()) {
  const current = monthOf(today);
  if (month < current) return 0;
  if (month > current) return daysInMonth(month);
  return daysInMonth(month) - new Date(today.getTime() + KENYA_MS).getUTCDate() + 1;
}

// An affiliate's own targets (affiliates.targets), cleaned: only what's set is kept — money,
// families, and (a manager's) teamMoney / teamFamilies. 0 is kept (= no target for them); an empty
// box follows Settings. null = Settings for all.
function normaliseTargets(raw) {
  const r = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!r || typeof r !== "object") return null;
  const out = {};
  const set = (v) => v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v));
  if (set(r.money)) out.money = money(clamp(r.money, 0, 1e9, 0));
  if (set(r.families)) out.families = Math.round(clamp(r.families, 0, 100000, 0));
  if (set(r.teamMoney)) out.teamMoney = money(clamp(r.teamMoney, 0, 1e9, 0));
  if (set(r.teamFamilies)) out.teamFamilies = Math.round(clamp(r.teamFamilies, 0, 100000, 0));
  return Object.keys(out).length ? out : null;
}

const positive = (v) => (Number(v) > 0 ? Number(v) : null);

// The targets as they apply to one affiliate this month: { money, families } (null = no target),
// their own if set, else Settings'. `own` tells where each came from.
function effectiveTargets(settings, affiliate = null) {
  const s = normaliseSettings(settings);
  const own = normaliseTargets(affiliate?.targets) || {};
  return {
    money: positive(own.money ?? s.targetMoney),
    families: positive(own.families ?? s.targetFamilies),
    own: own.money !== undefined || own.families !== undefined,
  };
}

// A manager's team targets (the manager and everyone under them together): their own team targets
// if set, else the sum of everyone's targets (null when no one has one).
function teamTargets(manager, memberTargets) {
  const own = normaliseTargets(manager?.targets) || {};
  const sum = (key) => {
    const set = memberTargets.map((t) => t[key]).filter((v) => v > 0);
    return set.length ? (key === "money" ? money(set.reduce((a, b) => a + b, 0)) : set.reduce((a, b) => a + b, 0)) : null;
  };
  return {
    money: own.teamMoney !== undefined ? positive(own.teamMoney) : sum("money"),
    families: own.teamFamilies !== undefined ? positive(own.teamFamilies) : sum("families"),
    own: own.teamMoney !== undefined || own.teamFamilies !== undefined,
  };
}

// How one measure stands: met, on track (at or ahead of an even pace through the month), behind,
// missed (a month that's over), or none (no target). The pace counts the days already gone, so the
// 1st of the month is never "behind".
function measureProgress(target, value, month, today = new Date()) {
  const v = Number(value) || 0;
  if (!(target > 0)) return { target: null, value: v, percent: null, expected: null, remaining: null, state: "none" };
  const percent = Math.floor((v / target) * 100);
  const remaining = Math.max(0, target - v);
  const current = monthOf(today);
  const base = { target, value: v, percent, remaining };
  if (v >= target) return { ...base, expected: target, state: "met" };
  if (month < current) return { ...base, expected: target, state: "missed" };
  const gone = month > current ? 0 : new Date(today.getTime() + KENYA_MS).getUTCDate() - 1;
  const expected = (target * gone) / daysInMonth(month);
  return { ...base, expected: Math.round(expected * 100) / 100, state: v >= expected ? "on_track" : "behind" };
}

// Both measures together: none (no target), met (every target met), missed, behind, on track.
function overallState(parts) {
  const states = parts.map((p) => p.state).filter((s) => s !== "none");
  if (!states.length) return "none";
  if (states.every((s) => s === "met")) return "met";
  if (states.includes("missed")) return "missed";
  if (states.includes("behind")) return "behind";
  return "on_track";
}

// The milestone a percent has reached, for the bell: 100, 50, or null.
const milestoneReached = (percent) => (percent >= 100 ? 100 : percent >= 50 ? 50 : null);

module.exports = {
  portalRouteOf, isMonth, monthOf, addMonths, monthBounds, daysInMonth, monthLabel, daysLeftIn,
  normaliseTargets, effectiveTargets, teamTargets, measureProgress, overallState, milestoneReached,
  PROGRAMMES, PROGRAMME_LABEL, RECURRING, PAYOUT_METHODS, DEFAULT_SETTINGS, TEAM_BASES,
  normaliseSettings, normaliseCustomRates, effectiveSettings, teamShareFor, teamProblem, normaliseCode, suggestCode, phoneKey, emailKey, pickAttribution, isSelfReferral,
  CLAIM_ORDERS, nameKey, chooseClaim, prospectState, PROSPECT_STAGES, STAGE_KEYS, SETTABLE_STAGES, stageOf, stageProblem,
  commissionFor, availableFrom, commissionState, totals, firstNameOf, money,
};
