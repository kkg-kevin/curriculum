// Training of trainers (TOT): educators learning on a curriculum made for them while they teach.
//
//   learners.teacherId          set on an educator's own learner record (modules/tot/) — an adult
//                               learner, the educator themself: no guardian, their own name and
//                               phone in the guardian columns (which can't be empty), no parent login.
//   curricula.audience          "learners" (default) or "educators" — a TOT curriculum, offered only
//                               to educators (and its bootcamps sign adults up, not children).
//   curricula.completionTeacherLevel   for a TOT curriculum: the educator level (1–5) an educator
//                               reaches on holding a certificate for every course in it (optional).
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("learners", "teacherId"))) {
    await knex.schema.alterTable("learners", (table) => {
      table.string("teacherId", 36).nullable();
      table.index("teacherId");
    });
  }
  if (!(await knex.schema.hasColumn("curricula", "audience"))) {
    await knex.schema.alterTable("curricula", (table) => {
      table.string("audience", 20).notNullable().defaultTo("learners");
      table.integer("completionTeacherLevel").nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("learners", "teacherId")) {
    await knex.schema.alterTable("learners", (table) => {
      table.dropIndex("teacherId");
      table.dropColumn("teacherId");
    });
  }
  if (await knex.schema.hasColumn("curricula", "audience")) {
    await knex.schema.alterTable("curricula", (table) => {
      table.dropColumn("audience");
      table.dropColumn("completionTeacherLevel");
    });
  }
};
