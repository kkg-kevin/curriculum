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

// Narrows a query to what the Activity page asks for. Always scoped to one workspace. `action`
// may be a list ("password_changed,password_reset").
function applyFilters(query, { ownerAdminId, view, actorUserId, module, action, outcome, entityType, entityId, from, to, q }) {
  query.where({ ownerAdminId });
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

module.exports = AuditLogModel;
