// An educator's optional "How to help at home" note on a learner's report — shown to the family
// beside the teacher's comment. Edited with the remarks (draft reports only).
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("reports", "homeNote"))) {
    await knex.schema.alterTable("reports", (t) => {
      t.string("homeNote", 2000).nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("reports", "homeNote")) {
    await knex.schema.alterTable("reports", (t) => t.dropColumn("homeNote"));
  }
};
