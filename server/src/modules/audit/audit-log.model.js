const db = require("../../config/db");
const { generateId, toJson } = require("../../shared/utils/model.utils");

const TABLE = "audit_log";

// The Activity page's tabs — each one a kind of thing that happened. Sign-ins and other account
// events are their own tab, so the three record tabs leave them out. "edited" is everything done
// to a record that isn't adding or removing it, including named actions ("mark paid", "issue").
const ADDING = ["create", "link"];
const REMOVING = ["delete", "unlink"];
const VIEWS = {
  signins: (w) => w.where("module", "account"),
  added: (w) => w.whereIn("action", ADDING).where((x) => x.whereNot("module", "account").orWhereNull("module")),
  edited: (w) => w.whereNotIn("action", [...ADDING, ...REMOVING]).where((x) => x.whereNot("module", "account").orWhereNull("module")),
  deleted: (w) => w.whereIn("action", REMOVING).where((x) => x.whereNot("module", "account").orWhereNull("module")),
  problems: (w) => w.whereIn("outcome", ["refused", "failed"]),
};

// The records a page can show a "Created by · Last changed by" stamp for (12 Nov 2026): the table
// the log stores them as, and the address their parts are changed under — a course's sessions and
// modules are logged at /api/courses/<id>/…, a curriculum's stages, pathways and versions at
// /api/curricula/<id>/…, so the record together with its parts is "this entity, or anything
// changed under its address".
const RECORDS = {
  // Records with their own page.
  courses: ["/api/courses/"],
  assessments: ["/api/assessments/"],
  curricula: ["/api/curricula/"],
  learning_hubs: ["/api/learning-hubs/"],
  classes: ["/api/classes/"],
  teachers: ["/api/teachers/", "/api/educator-profiles/", "/api/tot/educators/"],
  learners: ["/api/learners/"],
  bootcamps: ["/api/bootcamps/"],
  general_events: ["/api/general-events/"],
  competitions: ["/api/competitions/"],
  qa_visits: ["/api/qa/visits/"],
  checkin_sessions: ["/api/checkins/sessions/"],
  checkin_schedules: ["/api/checkins/schedules/"],
  mentor_checkin_rounds: ["/api/mentor-checkins/rounds/"],
  mentor_checkin_meetings: ["/api/mentor-checkins/meetings/"],
  billing_invoices: ["/api/billing/"],
  teacher_claims: ["/api/claims/"],
  mentor_bookings: ["/api/mentor-bookings/"],
  home_learning_households: ["/api/home-learning/"],
  club_memberships: ["/api/tech-clubs/"],
  pathway_subscriptions: ["/api/pathway-subscriptions/"],
  leads: ["/api/leads/"],
  affiliates: ["/api/affiliates/"],
  // Records edited in a list or a pop-up.
  qa_templates: ["/api/qa/templates/"],
  checkin_templates: ["/api/checkins/templates/"],
  mentor_checkin_templates: ["/api/mentor-checkins/templates/"],
  home_learning_packages: ["/api/billing/packages/"],
  club_packages: ["/api/billing/club-packages/"],
  pathway_packages: ["/api/pathway-subscriptions/packages/"],
  competencies: ["/api/competencies/"],
  pathway_templates: ["/api/pathway-templates/"],
  system_levels: ["/api/system-levels/"],
  items: ["/api/items/", "/api/inventory/"],
  rooms: ["/api/rooms/"],
  access_roles: ["/api/access/roles/"],
  event_games: ["/api/bootcamps/games/"],
  class_groups: ["/api/class-groups/"],
  users: ["/api/admin-tools/collaborators/", "/api/claims/supervisors/"],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Bookkeeping that isn't a change to the record.
const NOT_CHANGES = ["viewed", "login", "logout", "login_failed", "session_expired"];

function withinRecord(query, recordType, recordId) {
  if (!UUID.test(String(recordId || "")) || !/^[a-z_]{2,64}$/.test(String(recordType || ""))) return query.whereRaw("1 = 0");
  const roots = RECORDS[recordType] || [];
  return query.where((w) => {
    w.where({ entityType: recordType, entityId: recordId });
    for (const root of roots) w.orWhere("path", `${root}${recordId}`).orWhere("path", "like", `${root}${recordId}/%`);
  });
}

// Narrows a query to what the Activity page asks for. Always scoped to one workspace. `action`
// may be a list ("password_changed,password_reset"). `recordType` + `recordId`: one record with
// its parts (RECORDS above).
function applyFilters(query, { ownerAdminId, view, actorUserId, module, action, outcome, entityType, entityId, recordType, recordId, from, to, q }) {
  query.where({ ownerAdminId });
  if (recordType) withinRecord(query, recordType, recordId);
  if (view && VIEWS[view]) query.where((w) => VIEWS[view](w));
  if (actorUserId) query.where({ actorUserId });
  if (module) query.where({ module });
  if (action) query.whereIn("action", String(action).split(",").map((a) => a.trim()).filter(Boolean));
  if (outcome) query.where({ outcome });
  if (entityType) query.where({ entityType });
  if (entityId) query.where({ entityId });
  if (from) query.where("createdAt", ">=", from);
  if (to) query.where("createdAt", "<=", to);
  if (q) {
    const like = `%${String(q).replace(/[\\%_]/g, "\\$&")}%`;
    query.where((w) => w.where("summary", "like", like).orWhere("entityLabel", "like", like).orWhere("actorName", "like", like));
  }
  return query;
}

// The activity log — see 20261006090000_create_audit_log.js. Append-only by design: there is
// deliberately no update(), and the only removal is prune() for entries past retention.
const AuditLogModel = {
  create(entry) {
    return db(TABLE).insert({ ...entry, id: generateId(), changes: toJson(entry.changes), createdAt: entry.createdAt || new Date() });
  },

  // Newest first. Asks for one more than `limit` so the caller can tell whether there's a next page.
  find(filters, { limit = 50, offset = 0 } = {}) {
    return applyFilters(db(TABLE), filters).orderBy("createdAt", "desc").orderBy("id", "desc").limit(limit + 1).offset(offset);
  },

  // How many entries each tab holds, for whatever else is being filtered on (person, area, dates,
  // search) — never the tab's own narrowing, so every tab's number shows at once.
  // One query, not one per tab: this runs on every visit and every filter change. The conditions
  // mirror VIEWS above.
  async countByView(filters) {
    const { view, action, outcome, ...rest } = filters;
    const record = "(module <> 'account' OR module IS NULL)";
    const row = await applyFilters(db(TABLE), rest)
      .select(db.raw("COUNT(*) AS `all`"))
      .select(db.raw("COALESCE(SUM(module = 'account'), 0) AS signins"))
      .select(db.raw(`COALESCE(SUM(action IN ('create', 'link') AND ${record}), 0) AS added`))
      .select(db.raw(`COALESCE(SUM(action NOT IN ('create', 'link', 'delete', 'unlink') AND ${record}), 0) AS edited`))
      .select(db.raw(`COALESCE(SUM(action IN ('delete', 'unlink') AND ${record}), 0) AS deleted`))
      .select(db.raw("COALESCE(SUM(outcome IN ('refused', 'failed')), 0) AS problems"))
      .first();
    return Object.fromEntries(["all", "signins", "added", "edited", "deleted", "problems"].map((key) => [key, Number(row?.[key] || 0)]));
  },

  // Everyone who appears in this workspace's log, with when they last did something.
  actors(ownerAdminId) {
    return db(TABLE)
      .where({ ownerAdminId })
      .whereNotNull("actorUserId")
      .groupBy("actorUserId")
      .select("actorUserId")
      .max({ lastActiveAt: "createdAt", actorName: "actorName", actorEmail: "actorEmail", actorRole: "actorRole" })
      .count({ entries: "*" })
      .orderBy("lastActiveAt", "desc");
  },

  modules(ownerAdminId) {
    return db(TABLE).where({ ownerAdminId }).whereNotNull("module").distinct("module").pluck("module");
  },

  prune(olderThan) {
    return db(TABLE).where("createdAt", "<", olderThan).del();
  },
};

// A record's stamp: who made it, who changed it (it or its parts) last, and who has worked on it —
// successful changes only, from this workspace's log.
AuditLogModel.stamp = async function stamp(ownerAdminId, recordType, recordId) {
  const changes = () => withinRecord(db(TABLE).where({ ownerAdminId, outcome: "success" }).whereNotIn("action", NOT_CHANGES), recordType, recordId);
  const who = ["actorUserId", "actorName", "actorEmail", "actorRole", "actorAccessRole", "createdAt"];
  const created = await db(TABLE).where({ ownerAdminId, outcome: "success", action: "create", entityType: recordType, entityId: recordId })
    .orderBy("createdAt", "asc").first(who);
  const last = await changes().whereNot((w) => w.where({ action: "create", entityType: recordType, entityId: recordId }))
    .orderBy("createdAt", "desc").first([...who, "action", "summary"]);
  // Each person once per role they acted in (the tag: Admin, a staff role like "CEO", Educator…).
  const people = await changes().groupBy("actorUserId", "actorName", "actorRole", "actorAccessRole")
    .select("actorUserId", "actorName", "actorRole", "actorAccessRole").max({ actorEmail: "actorEmail" })
    .count({ count: "*" }).max({ lastAt: "createdAt" })
    .orderBy("count", "desc").limit(8);
  const total = Number((await changes().count({ n: "*" }).first())?.n || 0);
  const deletes = Number((await changes().whereIn("action", ["delete", "unlink"]).count({ n: "*" }).first())?.n || 0);
  return { created: created || null, last: last || null, people: people.map((p) => ({ ...p, count: Number(p.count) })), total, deletes };
};
AuditLogModel.RECORDS = RECORDS;

module.exports = AuditLogModel;
