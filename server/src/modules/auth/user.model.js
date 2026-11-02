const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull, stringifyJsonFields } = require("../../shared/utils/model.utils");

const TABLE = "users";
const JSON_FIELDS = ["allowedModules", "emailPreferences", "extraRoles"];

const UserModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll({ invitedByAdminId } = {}) {
    let query = db(TABLE);
    if (invitedByAdminId) query = query.where({ invitedByAdminId });
    return query.orderBy("createdAt", "desc");
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
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  // A login's kept password (learner-password-vault.js) goes with it.
  async delete(id) {
    await db("learner_login_secrets").where({ userId: id }).del().catch(() => {});
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = UserModel;
