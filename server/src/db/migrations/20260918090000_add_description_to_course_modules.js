// A module groups a course's Sessions under a named bucket (see 20260807120005_courses.js) —
// this adds a free-text description so a course builder can say what a module actually covers,
// same "text" column shape as courses.description. Idempotent (hasColumn guard) so a re-run /
// partial rollback is safe.
exports.up = async function up(knex) {
  const present = await knex.schema.hasColumn("course_modules", "description");
  if (!present) {
    await knex.schema.alterTable("course_modules", (t) => t.text("description").nullable());
  }
};

exports.down = async function down(knex) {
  const present = await knex.schema.hasColumn("course_modules", "description");
  if (present) {
    await knex.schema.alterTable("course_modules", (t) => t.dropColumn("description"));
  }
};
