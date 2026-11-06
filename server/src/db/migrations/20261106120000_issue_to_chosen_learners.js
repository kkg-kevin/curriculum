// An assessment issued to chosen learners of a class only (6 Nov 2026): assessment_issues.forLearnerIds,
// a JSON list of learner ids — null (every issue until now) means the whole class, including
// learners who join later. Chosen learners alone see it, take it and are asked for it; nobody else
// in the class is, and a learner joining later doesn't get it. Issuing it again to more learners
// adds them; issuing it to the whole class clears the list.
exports.up = async function up(knex) {
  if (await knex.schema.hasColumn("assessment_issues", "forLearnerIds")) return;
  await knex.schema.alterTable("assessment_issues", (table) => {
    table.json("forLearnerIds").nullable();
  });
};

exports.down = async function down(knex) {
  if (!(await knex.schema.hasColumn("assessment_issues", "forLearnerIds"))) return;
  await knex.schema.alterTable("assessment_issues", (table) => table.dropColumn("forLearnerIds"));
};
