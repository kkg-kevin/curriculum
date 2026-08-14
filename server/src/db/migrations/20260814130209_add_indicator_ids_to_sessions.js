// A session tags which of its course's competency indicators it addresses — plain id list, same
// "just attach, no functionality wired" posture as course_competency_links. Not read by any
// scoring/grading logic today; kept alongside outcomes/mainConcepts/etc. as one more JSON column
// on the session itself, rather than a separate link table, since the whole session is already
// authored/saved as one form (see SessionForm.jsx) exactly like assessmentIds already is.
exports.up = async function up(knex) {
  await knex.schema.alterTable("course_sessions", (table) => {
    table.json("indicatorIds").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("course_sessions", (table) => {
    table.dropColumn("indicatorIds");
  });
};
