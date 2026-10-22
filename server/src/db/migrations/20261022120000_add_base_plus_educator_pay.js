// "Base plus" — a fourth way of paying a part-time educator (see modules/claims/claim.service.js):
// each session pays the workspace's session rate (the base) plus a commission for every learner
// enrolled in the class.
//
// claim_settings  commissionRate — the commission per learner per session (Settings → Educator
//                 pay). Null = Base plus isn't offered.
// teacher_claims  what a Base plus claim was worked out on, fixed at submit time like every other
//                 figure: learnerCount and commissionRate. The base is the claim's sessionRate;
//                 its rate is the whole per-session amount (base + learners × commission).
// teachers        nothing: payRateTypes (JSON) simply takes "base_plus" as one more value.
//
// Additive and idempotent (hasColumn guards).

async function addColumns(knex, table, columns) {
  for (const [name, add] of columns) {
    if (!(await knex.schema.hasColumn(table, name))) {
      await knex.schema.alterTable(table, (t) => add(t));
    }
  }
}

exports.up = async function up(knex) {
  await addColumns(knex, "claim_settings", [
    ["commissionRate", (t) => t.decimal("commissionRate", 12, 3).nullable()],
  ]);
  await addColumns(knex, "teacher_claims", [
    ["learnerCount", (t) => t.integer("learnerCount").nullable()],
    ["commissionRate", (t) => t.decimal("commissionRate", 12, 3).nullable()],
  ]);
};

exports.down = async function down(knex) {
  for (const [table, column] of [["teacher_claims", "commissionRate"], ["teacher_claims", "learnerCount"], ["claim_settings", "commissionRate"]]) {
    if (await knex.schema.hasColumn(table, column)) {
      await knex.schema.alterTable(table, (t) => t.dropColumn(column));
    }
  }
};
