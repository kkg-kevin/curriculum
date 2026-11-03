// A TOT bootcamp (bootcamps.audience "educators") is for educators of any age: its age range is
// always 15-100 (bootcamp.service.js sets it on every save). This brings the ones already saved
// with a narrower range into line. Safe to run again.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("bootcamps", "audience"))) return;
  await knex("bootcamps").where({ audience: "educators" }).update({ ageMin: 15, ageMax: 100 });
};

// Nothing to undo — the earlier ranges weren't kept.
exports.down = async function down() {};
