const db = require("../../config/db");
const { generateId, updateRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "learner_hub_links";

// Records which learning hub(s) a learner is enrolled at — a learner stays one independent
// identity/record (name, guardian, gender), it just gets linked to whichever hub(s) it's
// enrolled at, same many-to-many pattern as teacher-hub-link.model.js. Unlike the teacher
// link (which is a bare {teacherId, hubId} pair), a learner's enrollment also carries which
// class within that hub, a hub-scoped admission number, and its own enrollment status —
// distinct from the teacher case because a learner can only ever be "in" one class at a time
// within a given hub, and that placement + admission number are hub-specific facts.
const LearnerHubLinkModel = {
  findAll() {
    return db(TABLE);
  },

  findByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId });
  },

  findByHubId(hubId) {
    return db(TABLE).where({ hubId });
  },

  findByClassId(classId) {
    return db(TABLE).where({ classId });
  },

  findOne(learnerId, hubId) {
    return firstOrNull(db(TABLE).where({ learnerId, hubId }));
  },

  countByAdmissionPrefix(prefix) {
    return db(TABLE)
      .where("admissionNumber", "like", `${prefix}%`)
      .count({ count: "*" })
      .first()
      .then((r) => Number(r.count));
  },

  // Idempotent like teacher-hub-link's `link` — if this learner already has an enrollment at
  // this hub, returns the existing row untouched rather than creating a duplicate (use
  // `update` to change its class/status/admissionNumber instead).
  async create({ learnerId, hubId, classId, admissionNumber, status }) {
    const existing = await firstOrNull(db(TABLE).where({ learnerId, hubId }));
    if (existing) return existing;
    const now = new Date();
    const item = {
      id: generateId(),
      learnerId,
      hubId,
      classId: classId || null,
      admissionNumber: admissionNumber || null,
      status: status || "active",
      createdAt: now,
      updatedAt: now,
    };
    await db(TABLE).insert(item);
    return item;
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  async unlink(learnerId, hubId) {
    const count = await db(TABLE).where({ learnerId, hubId }).del();
    return count > 0;
  },

  deleteByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId }).del();
  },

  deleteByHubId(hubId) {
    return db(TABLE).where({ hubId }).del();
  },

  // A class was deleted — the learner stays enrolled at the hub, just no longer placed in a
  // class there, mirroring the "unassigned" state the rest of the app already understands.
  clearClassId(classId) {
    return db(TABLE).where({ classId }).update({ classId: null, updatedAt: new Date() });
  },
};

module.exports = LearnerHubLinkModel;
