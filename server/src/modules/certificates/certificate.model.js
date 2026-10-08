const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "certificates";
const JSON_FIELDS = ["snapshot"];

// One record per (learner, identityKey) — see the migration for what an identityKey is and why.
// "revoked" keeps the row, so a certificate's number and verification link stay the same if it
// is reinstated.
const CertificateModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll({ learnerId, classId, courseId, hubId, hubIds, ownerAdminId, kind, status } = {}) {
    let query = db(TABLE);
    if (learnerId) query = query.where({ learnerId });
    if (classId) query = query.where({ classId });
    if (courseId) query = query.where({ courseId });
    if (hubId) query = query.where({ hubId });
    if (hubIds) query = query.whereIn("hubId", hubIds);
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (kind) query = query.where({ kind });
    if (status) query = query.where({ status });
    return query.orderBy("issuedAt", "desc");
  },

  findByIdentity(learnerId, identityKey) {
    return firstOrNull(db(TABLE).where({ learnerId, identityKey }));
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findByVerifyToken(verifyToken) {
    return firstOrNull(db(TABLE).where({ verifyToken }));
  },

  // The highest number already issued with this prefix ("DF-2026-"), or null — the fixed-width
  // counter makes a plain string sort the same as a numeric one.
  async lastNumberWithPrefix(prefix) {
    const row = await firstOrNull(
      db(TABLE).where("certificateNumber", "like", `${prefix}%`).orderBy("certificateNumber", "desc").select("certificateNumber")
    );
    return row?.certificateNumber || null;
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  // Called from learner.service.js's deleteLearner, alongside their reports.
  deleteByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId }).del();
  },
};

module.exports = CertificateModel;
