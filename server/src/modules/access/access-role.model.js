const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull, stringifyJsonFields } = require("../../shared/utils/model.utils");

const TABLE = "access_roles";
const JSON_FIELDS = ["permissions"];

const AccessRoleModel = {
  findAll(ownerAdminId) {
    return db(TABLE).where({ ownerAdminId }).orderBy("name", "asc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findOwned(id, ownerAdminId) {
    return firstOrNull(db(TABLE).where({ id, ownerAdminId }));
  },

  findByName(ownerAdminId, name) {
    return firstOrNull(db(TABLE).where({ ownerAdminId, name }));
  },

  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  // Staff per role, for the role list and the "can't delete a role in use" check.
  async countStaff(roleIds) {
    if (!roleIds.length) return new Map();
    const rows = await db("users").whereIn("roleId", roleIds).where({ role: "collaborator" }).groupBy("roleId").select("roleId").count({ count: "*" });
    return new Map(rows.map((row) => [row.roleId, Number(row.count)]));
  },
};

module.exports = AccessRoleModel;
