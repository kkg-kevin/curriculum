// Module reports (19 Nov 2026): the course's final combined report, for one module — the
// module's sessions only. A report is now identified by (learner, course, class, sessionId,
// moduleId):
//   session report       sessionId set,  moduleId null
//   module report        sessionId null, moduleId set
//   final course report  sessionId null, moduleId null
// Everything that means "the final course report" must test BOTH for null.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("reports", "moduleId"))) {
    await knex.schema.alterTable("reports", (table) => {
      table.string("moduleId", 36).nullable();
      table.index(["classId", "courseId", "moduleId"]);
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("reports", "moduleId")) {
    await knex.schema.alterTable("reports", (table) => {
      table.dropIndex(["classId", "courseId", "moduleId"]);
      table.dropColumn("moduleId");
    });
  }
};
