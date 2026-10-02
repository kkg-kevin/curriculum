const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "admin_connections";

// A sharing connection between two admins — see 20261004090000_create_admin_sharing.js.
const AdminConnectionModel = {
  create(data) {
    return createRecord(db, TABLE, data);
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // Every connection this admin is part of, whichever side started it.
  findForAdmin(adminId) {
    return db(TABLE).where({ requesterAdminId: adminId }).orWhere({ recipientAdminId: adminId }).orderBy("createdAt", "desc");
  },

  // The one connection between two admins, in either direction.
  findBetween(adminId, otherAdminId) {
    return firstOrNull(
      db(TABLE)
        .where({ requesterAdminId: adminId, recipientAdminId: otherAdminId })
        .orWhere({ requesterAdminId: otherAdminId, recipientAdminId: adminId })
    );
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = AdminConnectionModel;
