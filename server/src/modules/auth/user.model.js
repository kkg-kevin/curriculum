const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "users";

const UserModel = {
  create(data) {
    return createRecord(db, TABLE, data);
  },

  findAll() {
    return db(TABLE).orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findByEmail(email) {
    return firstOrNull(db(TABLE).whereRaw("LOWER(email) = ?", [email.toLowerCase()]));
  },

  // A learner's own dedicated login (see auth.service.js's setOrCreatePasswordByUsername) has no
  // email at all — matched by username instead, same null-safe shape as
  // learner.model.js's findByUsername.
  findByUsername(username) {
    if (!username) return null;
    return firstOrNull(db(TABLE).whereRaw("LOWER(username) = ?", [username.toLowerCase()]));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = UserModel;
