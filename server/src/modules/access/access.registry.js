// What a staff role's permissions can cover, and how an incoming request maps onto them.
//
// A permission is a module + an action. Staff accounts (role "collaborator") carry a role whose
// permissions say which modules they can View / Create / Edit / Delete in — see
// scope.middleware.js's attachOwnRecords for enforcement and access.service.js for how a user's
// effective permissions are resolved.
//
// The client builds its role editor from GET /api/access/modules (served from this file), and its
// sidebar/route gating uses the same keys — keep sidebar `module` keys in
// client/src/components/ui/Sidebar.jsx and client/src/routes/StaffAccessGate.jsx identical to these.

const ACTIONS = ["view", "create", "edit", "delete"];

// `legacy: true` marks the modules a collaborator could be granted before roles existed (the
// allowedModules era); a collaborator with no role still resolves through them exactly as before.
const MODULES = [
  { key: "learning-hubs", label: "Learning Hubs", group: "Workspace", legacy: true },
  { key: "curriculum", label: "Curriculum", group: "Teaching", legacy: true },
  { key: "courses", label: "Courses", group: "Teaching", legacy: true },
  { key: "assessments", label: "Assessments", group: "Teaching", legacy: true },
  { key: "learners", label: "Learners", group: "People", legacy: true },
  { key: "teachers", label: "Educators", group: "People", legacy: true },
  { key: "classes", label: "Classes", group: "Teaching", legacy: true },
  { key: "attendance", label: "Attendance", group: "Teaching", legacy: true },
  { key: "timetable", label: "Timetable", group: "Teaching", legacy: true },
  { key: "home-learning", label: "Home Learning", group: "Programmes", legacy: true },
  { key: "competitions", label: "Competitions", group: "Programmes", legacy: true },
  { key: "bootcamps", label: "Bootcamps", group: "Programmes", legacy: true },
  { key: "reports", label: "Reports", group: "Teaching", legacy: true },
  { key: "notifications", label: "Notifications", group: "Workspace", legacy: true },
  { key: "settings", label: "Settings", group: "Workspace", legacy: true },
  { key: "billing", label: "Billing", group: "Finance" },
  { key: "hub-visits", label: "Hub visits & revenue", group: "Finance" },
];

const MODULE_KEYS = MODULES.map((m) => m.key);
const LEGACY_MODULE_KEYS = MODULES.filter((m) => m.legacy).map((m) => m.key);

// Request path prefix → the module that gates it.
const PATH_PREFIX_TO_MODULE = {
  "/api/curricula": "curriculum",
  "/api/competencies": "settings",
  "/api/pathway-templates": "settings",
  "/api/system-levels": "settings",
  "/api/inventory": "settings",
  "/api/items": "settings",
  "/api/learning-hubs": "learning-hubs",
  "/api/teachers": "teachers",
  "/api/classes": "classes",
  "/api/class-groups": "classes",
  "/api/rooms": "classes",
  "/api/learners": "learners",
  "/api/courses": "courses",
  "/api/attendance": "attendance",
  "/api/timetable": "timetable",
  "/api/assessments": "assessments",
  "/api/assessment-submissions": "assessments",
  "/api/reports": "reports",
  "/api/competitions": "competitions",
  "/api/bootcamps": "bootcamps",
  "/api/notifications": "notifications",
  "/api/home-learning": "home-learning",
  "/api/billing": "billing",
  "/api/hub-visits": "hub-visits",
};

// Settings catalogs are shared reference data: reading one (to pick from it) is also allowed by
// viewing any module that uses it, without the Settings permission. Changing a catalog — and the
// Settings page itself — still needs Settings.
const AUTHORING_MODULES = ["assessments", "courses", "curriculum"];
const CATALOG_READERS = {
  "/api/competencies": AUTHORING_MODULES,
  "/api/pathway-templates": AUTHORING_MODULES,
  "/api/system-levels": ["curriculum"],
  "/api/inventory": ["assessments", "courses", "billing"],
  "/api/items": ["assessments", "courses", "billing"],
};

// Surfaces only the workspace owner can use, whatever a staff role says: staff/role management,
// moving content between admins, and the cross-workspace platform analytics.
const OWNER_ONLY_PREFIXES = ["/api/admin-tools", "/api/access", "/api/reports/platform-analytics"];

// Requests whose meaning isn't what their HTTP method suggests. Checked before the default rules.
const ACTION_OVERRIDES = [
  // Raising a Home Learning invoice creates a billing invoice — gated by Billing, not Home Learning.
  { method: "POST", pattern: /^\/api\/home-learning(\/[^/]+)?\/invoices$/, module: "billing", action: "create" },
  // Approving a website sign-up records its payment; declining one removes its accounts.
  { method: "POST", pattern: /^\/api\/home-learning\/[^/]+\/approve-payment$/, module: "billing", action: "edit" },
  { method: "POST", pattern: /^\/api\/home-learning\/[^/]+\/decline-signup$/, module: "home-learning", action: "delete" },
  // Issuing, cancelling and recording a payment change an existing invoice.
  { method: "POST", pattern: /^\/api\/billing\/[^/]+\/(issue|cancel|payments)$/, module: "billing", action: "edit" },
  // Detaching a competency, pathway or material from a course or assessment edits that course or
  // assessment — nothing is deleted (attaching one is already an edit).
  { method: "DELETE", pattern: /^\/api\/courses\/[^/]+\/(competencies|pathways|inventory)\/links\/[^/]+$/, module: "courses", action: "edit" },
  { method: "DELETE", pattern: /^\/api\/assessments\/[^/]+\/(competencies|pathways|inventory)\/links\/[^/]+$/, module: "assessments", action: "edit" },
];

// A POST that only works something out without saving it.
const READ_ONLY_POST = /\/(preview|search|validate|check|export)$/;
// An id-shaped path segment (records use UUIDs).
const ID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Express routes ignore letter case and a trailing slash, so the rules here must too — otherwise
// "/api/x/Approve-Payment/" would reach the same handler while missing its rule.
function normalisePath(path) {
  return String(path || "").toLowerCase().replace(/\/+$/, "");
}

const underPrefix = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`);

function resolveModuleForPath(rawPath) {
  const path = normalisePath(rawPath);
  const prefix = Object.keys(PATH_PREFIX_TO_MODULE).find((p) => underPrefix(path, p));
  return prefix ? PATH_PREFIX_TO_MODULE[prefix] : null;
}

function isOwnerOnlyPath(rawPath) {
  const path = normalisePath(rawPath);
  return OWNER_ONLY_PREFIXES.some((p) => underPrefix(path, p));
}

/**
 * What a request needs: { module, action } or null when the path isn't a staff-gated module.
 * A read of a Settings catalog also carries `orView` — modules whose View permission is enough.
 *   GET/HEAD/OPTIONS → view · DELETE → delete · PUT/PATCH → edit
 *   POST → create for a new record, but edit when it's under an existing record
 *   (e.g. POST /api/courses/:id/sessions adds to that course), and view for previews/searches.
 */
function resolveAccess(method, rawPath) {
  const path = normalisePath(rawPath);
  const verb = method.toUpperCase();
  const override = ACTION_OVERRIDES.find((o) => o.method === verb && o.pattern.test(path));
  if (override) return { module: override.module, action: override.action };
  const module = resolveModuleForPath(path);
  if (!module) return null;
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") {
    const catalog = Object.keys(CATALOG_READERS).find((p) => underPrefix(path, p));
    return catalog ? { module, action: "view", orView: CATALOG_READERS[catalog] } : { module, action: "view" };
  }
  if (verb === "DELETE") return { module, action: "delete" };
  if (verb === "PUT" || verb === "PATCH") return { module, action: "edit" };
  if (READ_ONLY_POST.test(path)) return { module, action: "view" };
  const underExistingRecord = path.split("/").some((segment) => ID_SEGMENT.test(segment));
  return { module, action: underExistingRecord ? "edit" : "create" };
}

// "delete from Learners", "view Billing" — for 403 messages.
function describeAccess({ module, action }) {
  const label = MODULES.find((m) => m.key === module)?.label || module;
  const verb = { view: "view", create: "add to", edit: "edit", delete: "delete from" }[action] || action;
  return `${verb} ${label}`;
}

module.exports = {
  describeAccess,
  ACTIONS, MODULES, MODULE_KEYS, LEGACY_MODULE_KEYS, PATH_PREFIX_TO_MODULE,
  resolveModuleForPath, resolveAccess, isOwnerOnlyPath,
};
