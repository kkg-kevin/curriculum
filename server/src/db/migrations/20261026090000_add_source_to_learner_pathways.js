// A learner can now be on more than one pathway: the automatic one (their Developmental Stage's
// pathway, placed by its diagnostic) plus any staff assign by hand (Learner → Pathways → Add
// pathway). learner_pathways.source says which: "auto" or "manual". Only a manual one can be
// removed again.
//
// Every row so far came from a diagnostic or an advancement, except one whose first placement
// was a "manual" one (the placement endpoint, never wired into the app) — that is backfilled.
//
// Additive and idempotent (hasColumn guard; the backfill only touches "auto" rows).

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("learner_pathways", "source"))) {
    await knex.schema.alterTable("learner_pathways", (t) => {
      t.string("source", 16).notNullable().defaultTo("auto");
    });
  }
  const rows = await knex("learner_pathways").where({ source: "auto" }).select("id", "history");
  const manualIds = rows
    .filter((row) => {
      const history = typeof row.history === "string" ? JSON.parse(row.history || "[]") : row.history || [];
      return history[0]?.reason === "manual";
    })
    .map((row) => row.id);
  if (manualIds.length > 0) await knex("learner_pathways").whereIn("id", manualIds).update({ source: "manual" });
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("learner_pathways", "source")) {
    await knex.schema.alterTable("learner_pathways", (t) => t.dropColumn("source"));
  }
};
