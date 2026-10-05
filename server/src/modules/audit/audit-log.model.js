const db = require("../../config/db");
const { generateId, toJson } = require("../../shared/utils/model.utils");

const TABLE = "audit_log";

// Narrows a query to what the Activity page's filters ask for. Always scoped to one workspace.
function applyFilters(query, { ownerAdminId, actorUserId, module, action, outcome, entityType, entityId, from, to, q }) {
  query.where({ ownerAdminId });
  if (actorUserId) query.where({ actorUserId });
  if (module) query.where({ module });
  if (action) query.where({ action });
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
