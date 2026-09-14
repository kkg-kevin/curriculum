const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "mentor_sessions";

const MentorSessionModel = {
  create(data) {
    return createRecord(db, TABLE, data);
  },

  findAll({ ownerAdminId, hubId, teacherId, learnerId, paymentStatus } = {}) {
    let query = db(TABLE);
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (hubId) query = query.where({ hubId });
    if (teacherId) query = query.where({ teacherId });
    if (learnerId) query = query.where({ learnerId });
    if (paymentStatus) query = query.where({ paymentStatus });
    return query.orderBy([{ column: "sessionDate", order: "desc" }, { column: "createdAt", order: "desc" }]);
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

module.exports = MentorSessionModel;
