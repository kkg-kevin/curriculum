// Works out, from a request's method and path alone, WHAT is being changed — so every route is
// covered by the activity log without each controller having to say so.
//
//   PUT    /api/bootcamps/<id>                          → update the bootcamp <id>
//   POST   /api/courses/<id>/sessions                   → create a session in the course <id>
//   DELETE /api/courses/<id>/competencies/links/<cid>   → remove competency <cid> from course <id>
//   POST   /api/billing/<id>/issue                      → "issue" on the invoice <id>
//
// A path is read left to right: a word names a collection (looked up below), an id selects a
// record of the collection just named. Words that aren't a known collection are kept as the
// action's own name ("issue", "promote learners"). An unknown route therefore still produces a
// sensible entry about its top-level record rather than nothing.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// First path segment after /api → the records it manages. `module` is the staff-permission /
// sidebar area, used to filter the log.
const ROOTS = {
  curricula: { table: "curricula", noun: "curriculum", module: "curriculum" },
  competencies: { table: "competencies", noun: "competency", module: "settings" },
  "pathway-templates": { table: "pathway_templates", noun: "pathway", module: "settings" },
  "system-levels": { table: "system_levels", noun: "system level", module: "settings" },
  inventory: { table: "items", noun: "item", module: "settings" },
  items: { table: "items", noun: "item", module: "settings" },
  "learning-hubs": { table: "learning_hubs", noun: "learning hub", module: "learning-hubs" },
  teachers: { table: "teachers", noun: "educator", module: "teachers" },
  classes: { table: "classes", noun: "class", module: "classes" },
  "class-groups": { table: "class_groups", noun: "class group", module: "classes" },
  rooms: { table: "rooms", noun: "room", module: "classes" },
  learners: { table: "learners", noun: "learner", module: "learners" },
  "home-learning": { table: "home_learning_households", noun: "household", module: "home-learning" },
  courses: { table: "courses", noun: "course", module: "courses" },
  attendance: { table: "attendance", noun: "attendance record", module: "attendance" },
  timetable: { table: "timetable_slots", noun: "timetable slot", module: "timetable" },
  assessments: { table: "assessments", noun: "assessment", module: "assessments" },
  "assessment-submissions": { table: null, noun: "assessment work", module: "assessments" },
  reports: { table: "reports", noun: "report", module: "reports" },
  competitions: { table: "competitions", noun: "competition", module: "competitions" },
  bootcamps: { table: "bootcamps", noun: "bootcamp", module: "bootcamps" },
  billing: { table: "billing_invoices", noun: "invoice", module: "billing" },
  "hub-visits": { table: "hub_visits", noun: "hub visit", module: "hub-visits" },
  leads: { table: "leads", noun: "enquiry", module: "enquiries" },
  claims: { table: "teacher_claims", noun: "claim", module: "claims" },
  "admin-tools": { table: null, noun: "workspace", module: "people" },
  access: { table: null, noun: "workspace", module: "people" },
  sharing: { table: null, noun: "workspace", module: "people" },
  auth: { table: null, noun: "account", module: "account" },
  public: { table: null, noun: "website", module: "website" },
};

// A word further along the path → the collection it names. Keyed by the root it appears under,
// with "*" for names that mean the same everywhere.
const COLLECTIONS = {
  "*": {
    sessions: { table: "course_sessions", noun: "session" },
    modules: { table: "course_modules", noun: "module" },
    versions: { table: "curriculum_versions", noun: "version" },
    "age-categories": { table: "age_categories", noun: "developmental stage" },
    levels: { table: "progress_levels", noun: "progress level" },
    bands: { table: "performance_bands", noun: "performance band" },
    "pathway-bands": { table: "performance_bands", noun: "performance band" },
    "assessment-types": { table: "assessment_types", noun: "assessment type" },
    "evidence-types": { table: "evidence_types", noun: "evidence type" },
    availability: { table: "teacher_availability_slots", noun: "availability slot" },
    games: { table: "event_games", noun: "game" },
    roles: { table: "access_roles", noun: "role" },
    collaborators: { table: "users", noun: "staff member" },
    connections: { table: "admin_connections", noun: "sharing connection" },
    packages: { table: "home_learning_packages", noun: "package" },
    batches: { table: "billing_invoice_batches", noun: "invoice batch" },
    issues: { table: "assessment_issues", noun: "issued assessment" },
    submissions: { table: "assessment_submissions", noun: "submission" },
    admins: { table: "users", noun: "admin" },
    skips: { table: "timetable_session_skips", noun: "session change" },
    supervisors: { table: "users", noun: "supervisor" },
  },
  curricula: { pathways: { table: "pathways", noun: "pathway" } },
  bootcamps: { hubs: { table: "bootcamp_hubs", noun: "hub run" } },
  competitions: { hubs: { table: "competition_hubs", noun: "hub run" } },
};

// "<thing>/links[/<id>]" attaches or detaches an existing record — the id is that record's.
const LINKED = {
  competencies: { table: "competencies", noun: "competency", bodyKey: "competencyId" },
  pathways: { table: "pathway_templates", noun: "pathway", bodyKey: "pathwayId" },
  inventory: { table: "items", noun: "material", bodyKey: "inventoryItemId" },
  hubs: { table: "learning_hubs", noun: "learning hub", bodyKey: "hubId" },
  teachers: { table: "teachers", noun: "educator", bodyKey: "teacherId" },
  courses: { table: "courses", noun: "course", bodyKey: "courseId" },
  curricula: { table: "curricula", noun: "curriculum", bodyKey: "curriculumId" },
};

// Requests that change nothing worth a line in the log, or are recorded by hand elsewhere.
const SKIP = [
  /^\/api\/auth\/(activity|login|logout|forgot-password|reset-password|verify-password|signup)$/, // sign-in events: audit.service's recordAuth
  /^\/api\/notifications(\/|$)/, // marking your own notifications read
  /^\/api\/uploads(\/|$)/, // the upload itself; the save that uses the file is what's logged
  /^\/api\/audit(\/|$)/,
  /\/(preview|search|validate|check|export)$/, // work things out, save nothing
  /^\/api\/assessment-submissions\/submissions$/, // a learner opening an assessment
  /^\/api\/assessment-submissions\/submissions\/[^/]+\/draft$/, // autosave while answering
  /^\/api\/assessment-submissions\/issues\/course-progress$/, // automatic, on finishing a session
  /^\/api\/public\/diagnostics\//, // anonymous website diagnostic attempts
];

const normalise = (path) => String(path || "").split("?")[0].toLowerCase().replace(/\/+$/, "");

function shouldSkip(path) {
  const clean = normalise(path);
  return SKIP.some((pattern) => pattern.test(clean));
}

/**
 * { module, root, entity, parent, linked, collection, words, action } — or null when the path
 * isn't under /api.
 *   entity      the record being changed: { table, id, noun } (deepest one the path names)
 *   parent      the top-level record it sits under, when different
 *   linked      for "…/links": what is being attached/detached: { table, noun, id? , bodyKey }
 *   collection  set when the path ends on a collection, i.e. something is being added to it
 *   words       leftover path words — the action's own name
 */
function resolve(method, rawPath) {
  const segments = normalise(rawPath).split("/").filter(Boolean);
  if (segments[0] !== "api" || segments.length < 2) return null;
  const rootKey = segments[1];
  const root = ROOTS[rootKey] || { table: null, noun: rootKey.replace(/-/g, " "), module: rootKey };
  const verb = String(method).toUpperCase();

  let pending = root.table ? { table: root.table, noun: root.noun } : null;
  let entity = null;
  let parent = null;
  let linked = null;
  const words = [];
  let lastWord = null;

  for (const segment of segments.slice(2)) {
    if (UUID.test(segment)) {
      if (linked && !linked.id) linked.id = segment;
      else if (pending) {
        if (entity && !parent) parent = entity;
        entity = { ...pending, id: segment };
        pending = null;
      }
      continue;
    }
    if (segment === "links" && lastWord && LINKED[lastWord]) {
      // "competencies/links": the word before wasn't a collection of its own after all.
      if (words[words.length - 1] === lastWord) words.pop();
      linked = { ...LINKED[lastWord] };
      pending = null;
      lastWord = segment;
      continue;
    }
    const collection = (COLLECTIONS[rootKey] || {})[segment] || COLLECTIONS["*"][segment];
    if (collection) pending = { ...collection };
    else {
      words.push(segment.replace(/-/g, " "));
      pending = null;
    }
    lastWord = segment;
  }

  let action;
  if (linked) action = verb === "DELETE" ? "unlink" : "link";
  else if (verb === "DELETE") action = "delete";
  else if (verb === "PUT" || verb === "PATCH") action = "update";
  else if (pending) action = "create"; // the path ends on a collection: something is added to it
  else if (words.length) action = words.join(" ");
  else action = entity ? "update" : "create";

  return { module: root.module, root: rootKey, rootNoun: root.noun, entity, parent, linked, collection: pending, words, action };
}

module.exports = { resolve, shouldSkip, UUID, ROOTS };
