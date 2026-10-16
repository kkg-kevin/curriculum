const db = require("../../config/db");

// The forms that keep drafts, and for each one: where the record it edits lives (`table`, and the
// column that names a record there), whether a draft can start before there is a record (`canBeNew`),
// and `resolve(recordId)` — the record's workspace, plus what the draft takes from it (an
// assessment's type, a session's course) — or null when there's no such record.
const KINDS = {
  assessment: {
    table: "assessments",
    nameColumn: "name",
    canBeNew: true,
    async resolve(recordId) {
      const assessment = await db("assessments").where({ id: recordId }).first();
      return assessment ? { ownerAdminId: assessment.ownerAdminId, type: assessment.type, parentId: null } : null;
    },
  },
  course: {
    table: "courses",
    nameColumn: "name",
    canBeNew: true,
    async resolve(recordId) {
      const course = await db("courses").where({ id: recordId }).first();
      return course ? { ownerAdminId: course.ownerAdminId, type: null, parentId: null } : null;
    },
  },
  // A session is always edited inside its course, which is the parent shown in the lists.
  "course-session": {
    table: "course_sessions",
    nameColumn: "title",
    parentTable: "courses",
    canBeNew: false,
    async resolve(recordId) {
      const session = await db("course_sessions").where({ id: recordId }).first();
      if (!session) return null;
      const course = await db("courses").where({ id: session.courseId }).first();
      return course ? { ownerAdminId: course.ownerAdminId, type: null, parentId: course.id } : null;
    },
  },
};

module.exports = { KINDS };
