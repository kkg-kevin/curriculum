// Educator pay types (see modules/claims/claim.service.js).
//
// claim_settings  hourlyRate and dailyRate join sessionRate: the workspace's part-time rates, set
//                 once for every educator in Settings → Educator pay. Null = not offered.
// teachers        payRateTypes — which of "session", "hourly", "daily" a part-time educator may
//                 claim on (one or more). employmentType (part_time / full_time) already exists
//                 (20260807120003, stored but unused until now) and now decides who claims:
//                 full-time educators don't; empty counts as part time. Every educator from
//                 before this was paid per session, so each starts on "session", plus the
//                 hourly/daily choice in their old single paymentTerms field when it had one.
// teacher_claims  what a claim was worked out on: rateType, the rate, and the units (sessions,
//                 hours or days) in the whole course and delivered — fixed at submit time like
//                 every other figure on it. teacherEmail / teacherPhone go on the invoice the
//                 system generates for the claim. Older claims are all per session.
//
// teachers.sessionRate (an educator's own rate) is no longer read: every educator is paid the
// workspace's rates. The column is left in place so nothing stored is lost.
//
// Idempotent (hasColumn guards).

async function addColumns(knex, table, columns) {
  for (const [name, add] of columns) {
    if (!(await knex.schema.hasColumn(table, name))) {
      await knex.schema.alterTable(table, (t) => add(t));
    }
  }
}

exports.up = async function up(knex) {
  await addColumns(knex, "claim_settings", [
    ["hourlyRate", (t) => t.decimal("hourlyRate", 12, 3).nullable()],
    ["dailyRate", (t) => t.decimal("dailyRate", 12, 3).nullable()],
  ]);
  // Session pay can now be switched off by leaving its rate empty.
  await knex.schema.alterTable("claim_settings", (t) => {
    t.decimal("sessionRate", 12, 3).nullable().defaultTo(904.666).alter();
  });

  await addColumns(knex, "teachers", [["payRateTypes", (t) => t.json("payRateTypes").nullable()]]);
  for (const term of ["hourly", "daily"]) {
    await knex("teachers").whereNull("payRateTypes").where({ paymentTerms: term }).update({ payRateTypes: JSON.stringify(["session", term]) });
  }
  await knex("teachers").whereNull("payRateTypes").update({ payRateTypes: JSON.stringify(["session"]) });

  await addColumns(knex, "teacher_claims", [
    ["rateType", (t) => t.string("rateType", 20).notNullable().defaultTo("session")],
    ["rate", (t) => t.decimal("rate", 12, 3).nullable()],
    ["unitsTotal", (t) => t.decimal("unitsTotal", 10, 2).nullable()],
    ["unitsDelivered", (t) => t.decimal("unitsDelivered", 10, 2).nullable()],
    ["teacherEmail", (t) => t.string("teacherEmail", 190).nullable()],
    ["teacherPhone", (t) => t.string("teacherPhone", 40).nullable()],
  ]);
  await knex("teacher_claims").whereNull("rate").update({
    rate: knex.ref("sessionRate"),
    unitsTotal: knex.ref("sessionsTotal"),
    unitsDelivered: knex.ref("sessionsDelivered"),
  });
};

exports.down = async function down(knex) {
  const drop = async (table, names) => {
    for (const name of names) {
      if (await knex.schema.hasColumn(table, name)) await knex.schema.alterTable(table, (t) => t.dropColumn(name));
    }
  };
  await drop("teacher_claims", ["rateType", "rate", "unitsTotal", "unitsDelivered", "teacherEmail", "teacherPhone"]);
  // employmentType predates this migration and stays.
  await drop("teachers", ["payRateTypes"]);
  await knex("claim_settings").whereNull("sessionRate").update({ sessionRate: 904.666 });
  await knex.schema.alterTable("claim_settings", (t) => {
    t.decimal("sessionRate", 12, 3).notNullable().defaultTo(904.666).alter();
  });
  await drop("claim_settings", ["hourlyRate", "dailyRate"]);
};
