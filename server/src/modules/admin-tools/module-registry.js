// Canonical list of module keys a collaborator's access can be scoped to (see the
// 20260922110000_add_allowed_modules_to_users.js migration and scope.middleware.js's
// attachOwnRecords for enforcement). Settings sub-areas (competencies, pathway-templates,
// system-levels, inventory, items) collapse into one "settings" key — they're admin-gated
// Settings tabs, not independent sidebar destinations. class-groups/rooms fold under "classes";
// assessment-submissions folds under "assessments" — none of those four have their own sidebar
// entry either.
//
// Must stay in sync (identical key strings) with client/src/modules/settings/collaborators/
// moduleRegistry.js's MODULE_OPTIONS — that file drives the invite/edit checkbox UI and
// Sidebar.jsx's per-collaborator filtering. There is no shared code between client/ and server/
// (see CLAUDE.md), so these two lists can't literally import one another — keep them identical by
// hand whenever a module is added/removed/renamed.
const MODULE_KEYS = [
  "learning-hubs", "curriculum", "learners", "teachers", "classes", "courses",
  "competitions", "bootcamps", "assessments", "attendance", "timetable", "settings",
  "reports", "notifications",
];

// Maps an incoming request's path prefix to the module key that gates it, for
// scope.middleware.js's attachOwnRecords. Anything NOT listed here (billing, hub-visits,
// admin-tools, leads, uploads, notifications' own req.user.id-only scoping, platform-analytics)
// is never module-gated — either already refused by isRestrictedSurface, or reachable regardless
// of role per its own app.js mount.
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
};

function resolveModuleForPath(path) {
  const prefix = Object.keys(PATH_PREFIX_TO_MODULE).find((p) => path === p || path.startsWith(`${p}/`));
  return prefix ? PATH_PREFIX_TO_MODULE[prefix] : null;
}

module.exports = { MODULE_KEYS, PATH_PREFIX_TO_MODULE, resolveModuleForPath };
