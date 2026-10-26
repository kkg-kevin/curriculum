const { fk } = require("../helpers");

// Each learning hub names its Account Manager and Training Lead (two logins — staff, or an
// educator / hub / parent login that is also staff, or an admin). Hub check-ins take their people
// from the hub (modules/checkins/checkin.service.js): setting up check-ins uses them, and changing
// them on the hub moves its upcoming check-ins to the new people.
//
// A hub that already has check-ins set up takes the people from its most recently changed active
// schedule. Additive and idempotent (hasColumn guard; the fill-in only touches empty hubs).
exports.up = async function up(knex) {
  for (const column of ["accountManagerId", "trainingLeadId"]) {
    if (!(await knex.schema.hasColumn("learning_hubs", column))) {
      await knex.schema.alterTable("learning_hubs", (t) => fk(t, column).nullable());
    }
  }
  if (!(await knex.schema.hasTable("checkin_schedules"))) return;
  const schedules = await knex("checkin_schedules").where({ status: "active" }).orderBy("updatedAt", "desc").select("hubId", "accountManagerId", "trainingLeadId");
  const seen = new Set();
  for (const s of schedules) {
    if (seen.has(s.hubId)) continue;
    seen.add(s.hubId);
    await knex("learning_hubs").where({ id: s.hubId }).whereNull("accountManagerId").whereNull("trainingLeadId")
      .update({ accountManagerId: s.accountManagerId || null, trainingLeadId: s.trainingLeadId || null });
  }
};

exports.down = async function down(knex) {
  for (const column of ["accountManagerId", "trainingLeadId"]) {
    if (await knex.schema.hasColumn("learning_hubs", column)) {
      await knex.schema.alterTable("learning_hubs", (t) => t.dropColumn(column));
    }
  }
};
