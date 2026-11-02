// A class of an online / hybrid hub can have its own joining link (classes.meetingLink), so two
// classes of one hub — different learners, different educators, maybe the same hour — never
// share a meeting room. Empty means the class uses its hub's link (learning_hubs.meetingLink),
// which is every existing class. Resolved in timetable.service.js's onlineLinkForClass.
//
// Idempotent (hasColumn guard) so a re-run / partial rollback is safe.
exports.up = async function up(knex) {
  if (await knex.schema.hasColumn("classes", "meetingLink")) return;
  await knex.schema.alterTable("classes", (t) => {
    t.string("meetingLink", 500).nullable();
  });
};

exports.down = async function down(knex) {
  if (!(await knex.schema.hasColumn("classes", "meetingLink"))) return;
  await knex.schema.alterTable("classes", (t) => {
    t.dropColumn("meetingLink");
  });
};
