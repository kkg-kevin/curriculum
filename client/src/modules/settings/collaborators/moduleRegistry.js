// Canonical list of module keys an admin can grant/revoke on a collaborator (see
// CollaboratorsPanel.jsx's invite/edit checkbox UI) and that Sidebar.jsx filters
// COLLABORATOR_MENU_ITEMS against via user.allowedModules. Must stay in sync (identical key
// strings) with server/src/modules/admin-tools/module-registry.js's MODULE_KEYS /
// PATH_PREFIX_TO_MODULE — there is no shared code between client/ and server/ (see CLAUDE.md), so
// keep these two lists identical by hand whenever a module is added/removed/renamed.
export const MODULE_OPTIONS = [
  { key: "learning-hubs", label: "Learning Hubs" },
  { key: "curriculum",    label: "Curriculum" },
  { key: "learners",      label: "Learners" },
  { key: "teachers",      label: "Educators" },
  { key: "classes",       label: "Classes" },
  { key: "courses",       label: "Courses" },
  { key: "competitions",  label: "Competitions" },
  { key: "bootcamps",     label: "Bootcamps" },
  { key: "assessments",   label: "Assessments" },
  { key: "attendance",    label: "Attendance" },
  { key: "timetable",     label: "Timetable" },
  { key: "settings",      label: "Settings" },
  { key: "reports",       label: "Reports" },
  { key: "notifications", label: "Notifications" },
];

export const MODULE_KEYS = MODULE_OPTIONS.map((m) => m.key);
