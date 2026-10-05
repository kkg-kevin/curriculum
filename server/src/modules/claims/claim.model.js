const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull, stringifyJsonFields } = require("../../shared/utils/model.utils");

const TABLE = "teacher_claims";
const JSON_FIELDS = ["evidence"];
// mysql2 hands DECIMAL columns back as strings — every read goes through `shape` so the rest of
// the module can do arithmetic on them.
const MONEY_FIELDS = ["sessionRate", "courseAmount", "advanceDeducted", "amount"];

function shape(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of MONEY_FIELDS) if (out[field] != null) out[field] = Number(out[field]);
  return out;
}

// A thin Knex wrapper over teacher_claims — see the migration
// (20261007090000_create_teacher_claims.js) for what a claim is and how its status moves. The
// rules (who may submit, approve or decline, and when) live in claim.service.js.
const ClaimModel = {
  async create(data) {
    const record = await createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
    return shape({ ...record, evidence: data.evidence ?? null });
  },

  async findAll({ ownerAdminId, teacherId, classId, courseId, status, statuses, type } = {}) {
    let query = db(TABLE);
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (teacherId) query = query.where({ teacherId });
    if (classId) query = query.where({ classId });
    if (courseId) query = query.where({ courseId });
    if (status) query = query.where({ status });
    if (statuses) query = query.whereIn("status", statuses);
    if (type) query = query.where({ type });
    return (await query.orderBy("createdAt", "desc")).map(shape);
  },

  async findById(id) {
    return shape(await firstOrNull(db(TABLE).where({ id })));
  },

  async update(id, data) {
    return shape(await updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS)));
  },

  // Moves a claim on only if it is still in the status the caller saw — two reviewers deciding
  // the same claim at the same moment can't both win. Returns null when it had already moved.
  async transition(id, fromStatus, data) {
    const count = await db(TABLE).where({ id, status: fromStatus }).update({ ...data, updatedAt: new Date() });
    if (count === 0) return null;
    return ClaimModel.findById(id);
  },

  // Removes a claim only while it is still in `status` — true when a row went.
  async deleteIfStatus(id, status) {
    return (await db(TABLE).where({ id, status }).del()) > 0;
  },
};

module.exports = ClaimModel;
