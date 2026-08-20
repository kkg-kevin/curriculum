const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "learners";

const LearnerModel = {
  create(data) {
    return createRecord(db, TABLE, data);
  },

  // schoolId/classId/status/admissionNumber no longer live on the learner record — they're
  // per-enrollment facts on learner-hub-link.model.js. `ids` lets a caller pre-resolve "which
  // learners have a link matching X" via that table and filter down to just those (same
  // pattern as teacher.model.js's `ids` filter, fed by teacher-hub-link lookups).
  // limit/offset are optional and additive — omitted (as every current caller does), this
  // returns the full result set exactly as before.
  findAll({ ids, guardianEmail, limit, offset } = {}) {
    let query = db(TABLE);
    if (ids) query = query.whereIn("id", ids);
    if (guardianEmail) query = query.whereRaw("LOWER(guardianEmail) = ?", [guardianEmail.toLowerCase()]);
    // id as a secondary sort key — see class.model.js's findAll for why a tie-breaker matters
    // once LIMIT/OFFSET pagination is in play (e.g. several learners bulk-enrolled at once).
    query = query.orderBy([{ column: "createdAt", order: "desc" }, { column: "id", order: "asc" }]);
    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);
    return query;
  },

  // The single highest registrationNumber currently in use (or null if none exist yet) — since
  // registrationNumber is zero-padded to a fixed width behind a constant prefix (see
  // learner.service.js's nextRegistrationNumber), lexicographic ORDER BY matches numeric order,
  // so the existing index on this column resolves this in one indexed lookup instead of
  // loading every learner just to scan for the max.
  findHighestRegistrationNumber(prefix) {
    return firstOrNull(
      db(TABLE).where("registrationNumber", "like", `${prefix}%`).orderBy("registrationNumber", "desc")
    );
  },

  // Used both for uniqueness checks (learner.service.js) and to resolve a username-based
  // login (auth.service.js) back to the learner whose guardian account it should sign into.
  findByUsername(username) {
    if (!username) return null;
    return firstOrNull(db(TABLE).whereRaw("LOWER(username) = ?", [username.toLowerCase()]));
  },

  // Resolves the unauthenticated "share via QR" link back to a learner — see
  // learner.service.js's getPublicProfile.
  findByPublicToken(token) {
    if (!token) return null;
    return firstOrNull(db(TABLE).where({ publicToken: token }));
  },

  // Cross-hub lookup for getAllLearners' search branch (see AddExistingLearnerPanel on the
  // client) — partial, case-insensitive match against name, username, or registration number,
  // so a school doesn't need to already know a learner's exact username to find
  // them. LOWER() on both sides rather than relying on the DB's default collation.
  search(term, { limit = 20 } = {}) {
    const needle = `%${term.trim().toLowerCase()}%`;
    return db(TABLE)
      .where((qb) => {
        qb.whereRaw("LOWER(firstName) LIKE ?", [needle])
          .orWhereRaw("LOWER(lastName) LIKE ?", [needle])
          .orWhereRaw("LOWER(CONCAT(firstName, ' ', lastName)) LIKE ?", [needle])
          .orWhereRaw("LOWER(username) LIKE ?", [needle])
          .orWhereRaw("LOWER(registrationNumber) LIKE ?", [needle]);
      })
      .orderBy("firstName")
      .limit(limit);
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = LearnerModel;
