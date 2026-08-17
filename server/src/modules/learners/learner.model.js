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
  findAll({ ids, guardianEmail } = {}) {
    let query = db(TABLE);
    if (ids) query = query.whereIn("id", ids);
    if (guardianEmail) query = query.whereRaw("LOWER(guardianEmail) = ?", [guardianEmail.toLowerCase()]);
    return query.orderBy("createdAt", "desc");
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
  // so a school/branchAdmin doesn't need to already know a learner's exact username to find
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
