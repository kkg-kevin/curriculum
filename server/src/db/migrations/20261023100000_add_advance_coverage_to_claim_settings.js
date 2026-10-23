// How much of a course an educator must have delivered before they can ask for an advance
// (Settings → Educator pay; see modules/claims/claim.service.js). Two optional minimums — the
// advance opens when the educator reaches EITHER one, whichever comes first:
//
// claim_settings  advanceCoveragePercent   — a % of the course's sessions (0 = not used).
//                 advanceCoverageSessions  — a number of delivered sessions (0 = not used).
//
// Both 0 = no minimum: an advance can be asked for as soon as the course has sessions, as before.
// Additive and idempotent (hasColumn guards). Existing rows get 0, so nothing changes until an
// admin sets one.

async function addColumns(knex, table, columns) {
  for (const [name, add] of columns) {
    if (!(await knex.schema.hasColumn(table, name))) {
      await knex.schema.alterTable(table, (t) => add(t));
    }
  }
}

exports.up = async function up(knex) {
  await addColumns(knex, "claim_settings", [
    ["advanceCoveragePercent", (t) => t.integer("advanceCoveragePercent").notNullable().defaultTo(0)],
    ["advanceCoverageSessions", (t) => t.integer("advanceCoverageSessions").notNullable().defaultTo(0)],
  ]);
};

exports.down = async function down(knex) {
  for (const column of ["advanceCoverageSessions", "advanceCoveragePercent"]) {
    if (await knex.schema.hasColumn("claim_settings", column)) {
      await knex.schema.alterTable("claim_settings", (t) => t.dropColumn(column));
    }
  }
};
