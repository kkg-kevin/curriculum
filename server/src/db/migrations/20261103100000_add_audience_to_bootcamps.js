// Who a bootcamp is for, like curricula.audience: "learners" (default — children and young people)
// or "educators" — a TOT (training of trainers) bootcamp. A bootcamp already linked to a TOT
// curriculum becomes a TOT bootcamp here, since a bootcamp and its curriculum must agree
// (bootcamp.service.js's assertAudienceMatchesCurriculum).
// Idempotent (hasColumn guard).
exports.up = async function up(knex) {
  if (await knex.schema.hasColumn("bootcamps", "audience")) return;
  await knex.schema.alterTable("bootcamps", (t) => {
    t.string("audience", 20).notNullable().defaultTo("learners");
  });
  const totCurricula = await knex("curricula").where({ audience: "educators" }).pluck("id");
  if (totCurricula.length) {
    await knex("bootcamps").whereIn("curriculumId", totCurricula).update({ audience: "educators" });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("bootcamps", "audience")) {
    await knex.schema.alterTable("bootcamps", (t) => t.dropColumn("audience"));
  }
};
