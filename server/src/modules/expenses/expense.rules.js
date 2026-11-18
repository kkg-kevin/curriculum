// Expenses — the rules that need no database (tested in test/expenses.test.js). The service
// (expense.service.js) loads what these need and saves what they decide.
//
// A claim is one trip or purpose with one or more lines, each of which may carry proof (a receipt
// photo, an M-Pesa screenshot, a PDF). Since 18 Nov 2026, at the user's request, nothing about a
// line is checked when a claim is sent (proof, M-Pesa codes, dates, a declaration) and reviewers
// see no flags — the person reviewing judges each claim on what it shows.

const STATUSES = ["draft", "pending_supervisor", "pending_admin", "approved", "paid", "returned", "rejected"];
// The claimant may change a claim only while it is theirs: not yet sent, or sent back to them.
const EDITABLE = new Set(["draft", "returned"]);
// Waiting for someone to decide.
const PENDING = new Set(["pending_supervisor", "pending_admin"]);

const CLAIMANT_ROLES = ["admin", "collaborator", "teacher", "supervisor"];
const PAYMENT_METHODS = ["mpesa", "bank", "cash", "other"];
// A payment that leaves its own trail must say where to find it.
const REFERENCE_REQUIRED = new Set(["mpesa", "bank"]);

const DEFAULT_CATEGORIES = [
  { key: "transport", label: "Transport (fares, taxi, boda)", active: true },
  { key: "fuel", label: "Fuel", active: true },
  { key: "meals", label: "Meals & refreshments", active: true },
  { key: "materials", label: "Materials & resources", active: true },
  { key: "airtime", label: "Airtime & data", active: true },
  { key: "accommodation", label: "Accommodation", active: true },
  { key: "printing", label: "Printing & stationery", active: true },
  { key: "other", label: "Other", active: true },
];

const DEFAULT_SETTINGS = { categories: DEFAULT_CATEGORIES, currency: "KES" };

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Settings as stored. A category a workspace removed is kept (inactive) so old claims still name it.
function settingsOf(row) {
  if (!row) return { ...DEFAULT_SETTINGS, categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })) };
  const stored = Array.isArray(row.categories) && row.categories.length ? row.categories : DEFAULT_CATEGORIES;
  return {
    categories: stored.map((c) => ({ key: String(c.key), label: String(c.label || c.key), active: c.active !== false })),
    currency: row.currency || DEFAULT_SETTINGS.currency,
  };
}

const categoryOf = (settings, key) => settings.categories.find((c) => c.key === key) || null;
const categoryLabel = (settings, key) => categoryOf(settings, key)?.label || key;

// An M-Pesa transaction code as typed ("sgh7k2lm3p ", "SGH7 K2LM3P") → "SGH7K2LM3P"; null when
// none. Only tidied — not checked.
function normaliseMpesaCode(value) {
  const code = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code || null;
}

// "YYYY-MM-DD" in Kenya (UTC+3, no daylight saving).
function kenyaDay(date = new Date()) {
  return new Date(date.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

// Where a claim goes when it is sent: an educator with a supervisor → that supervisor first;
// everyone else (staff, supervisors, admins, an educator without one) → the workspace's approvers.
function routeFor({ claimantRole, supervisorId }) {
  return claimantRole === "teacher" && supervisorId ? "pending_supervisor" : "pending_admin";
}

// What a claim is worth: all its lines, and the lines still standing (a reviewer can turn single
// lines down).
function totalsOf(items) {
  const total = round2(items.reduce((s, i) => s + Number(i.amount || 0), 0));
  const approved = round2(items.filter((i) => i.status !== "rejected").reduce((s, i) => s + Number(i.amount || 0), 0));
  return { total, approved };
}

// Who may decide a claim at its stage. `viewer` = { userId, role, canApprove } (canApprove: the
// workspace owner/admins, and staff whose role grants Expenses → Edit). `soleApprover` = the
// claimant is the only person in the workspace who could approve at all (then they may — the
// claim is marked self-approved).
function canDecide(claim, viewer, { soleApprover = false } = {}) {
  const own = claim.claimantUserId === viewer.userId;
  if (claim.status === "pending_supervisor") {
    if (viewer.role === "supervisor") return viewer.userId === claim.supervisorId && !own;
    return viewer.canApprove && !own;
  }
  if (claim.status === "pending_admin" || claim.status === "approved") {
    if (!viewer.canApprove) return false;
    return !own || soleApprover;
  }
  return false;
}

const canPay = (claim, viewer, opts) => claim.status === "approved" && viewer.role !== "supervisor" && canDecide(claim, viewer, opts);

module.exports = {
  STATUSES, EDITABLE, PENDING, CLAIMANT_ROLES, PAYMENT_METHODS, REFERENCE_REQUIRED,
  DEFAULT_CATEGORIES, DEFAULT_SETTINGS,
  round2, settingsOf, categoryOf, categoryLabel, normaliseMpesaCode, kenyaDay,
  routeFor, totalsOf, canDecide, canPay,
};
