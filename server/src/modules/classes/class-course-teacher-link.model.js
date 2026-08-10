const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "class_course_teacher_links";

// Records which educator(s) teach a given course within a given class — replaces the old
// single Class.classTeacherId field. A course can have more than one educator (co-teachers,
// full access to that course within that class), and the same course can have different
// educators in different classes, same pattern as teacher-hub-link.model.js. Within one
// (classId, courseId) group, exactly one link carries isPrimary: true — the educator of
// record for attendance/grading/reports — while the rest are secondary co-teachers.
const ClassCourseTeacherLinkModel = {
  findByClassId(classId) {
    return db(TABLE).where({ classId });
  },

  findByTeacherId(teacherId) {
    return db(TABLE).where({ teacherId });
  },

  findByClassAndCourse(classId, courseId) {
    return db(TABLE).where({ classId, courseId });
  },

  async link(classId, courseId, teacherId) {
    const existing = await firstOrNull(db(TABLE).where({ classId, courseId, teacherId }));
    if (existing) return existing;
    // First educator assigned to this (class, course) pair becomes primary by default —
    // every other newly-added co-teacher joins as secondary until promoted.
    const groupHasAny = await firstOrNull(db(TABLE).where({ classId, courseId }));
    const item = {
      id: generateId(),
      classId,
      courseId,
      teacherId,
      isPrimary: !groupHasAny,
      createdAt: new Date(),
    };
    await db(TABLE).insert(item);
    return item;
  },

  // Promotes one educator to primary within its (classId, courseId) group and demotes every
  // other link in that same group — enforces "only one primary at a time" as a write-time
  // invariant rather than a validation rule, so it can never drift out of sync.
  async setPrimary(classId, courseId, teacherId) {
    const target = await firstOrNull(db(TABLE).where({ classId, courseId, teacherId }));
    if (!target) return null;
    await db.transaction(async (trx) => {
      await trx(TABLE).where({ classId, courseId }).update({ isPrimary: false });
      await trx(TABLE).where({ classId, courseId, teacherId }).update({ isPrimary: true });
    });
    return { ...target, isPrimary: true };
  },

  // Removing the primary co-teacher can't leave the group with none — promote whoever's
  // been on the course longest so there's always exactly one primary while any remain.
  async unlink(classId, courseId, teacherId) {
    const removed = await firstOrNull(db(TABLE).where({ classId, courseId, teacherId }));
    if (!removed) return false;

    await db.transaction(async (trx) => {
      await trx(TABLE).where({ classId, courseId, teacherId }).del();
      if (removed.isPrimary) {
        const nextPrimary = await trx(TABLE)
          .where({ classId, courseId })
          .orderBy("createdAt", "asc")
          .first();
        if (nextPrimary) await trx(TABLE).where({ id: nextPrimary.id }).update({ isPrimary: true });
      }
    });
    return true;
  },

  deleteByClassId(classId) {
    return db(TABLE).where({ classId }).del();
  },

  deleteByTeacherId(teacherId) {
    return db(TABLE).where({ teacherId }).del();
  },
};

module.exports = ClassCourseTeacherLinkModel;
