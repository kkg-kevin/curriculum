// Moving a learner between programmes (16 Nov 2026 — modules/learner-moves/): a hub class, a
// bootcamp run, Home Learning, a Tech Club or a pathway plan, from any of them. Every move is still
// one learner_transfers row per place left (one row when none was left), now saying which programme
// each side was and which record (household, membership, subscription, bootcamp), with a label kept
// as it read at the time — so the learner's Moves read right even after a record is renamed or gone.
// A pathway plan has no hub of its own, so both hub columns may now be empty.
//
// Rows written before: the Home Learning move ("Moved to Home Learning") and hub transfers / a hub's
// removal (hub → hub) get their programmes filled in.

const { fk } = require("../helpers");

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("learner_transfers", "toProgramme"))) {
    await knex.schema.alterTable("learner_transfers", (t) => {
      t.string("fromProgramme", 20).nullable();
      t.string("toProgramme", 20).nullable();
      fk(t, "fromRecordId").nullable();
      fk(t, "toRecordId").nullable();
      t.string("fromLabel", 200).nullable();
      t.string("toLabel", 200).nullable();
    });
  }
  await knex.schema.alterTable("learner_transfers", (t) => {
    fk(t, "fromHubId").nullable().alter();
    fk(t, "toHubId").nullable().alter();
    // Milliseconds, so moves made one after another always read back in order.
    t.datetime("createdAt", { precision: 3 }).notNullable().alter();
  });
  await knex("learner_transfers").whereNull("toProgramme").where({ notes: "Moved to Home Learning" })
    .update({ fromProgramme: "hub", toProgramme: "home_learning" });
  await knex("learner_transfers").whereNull("toProgramme").update({ fromProgramme: "hub", toProgramme: "hub" });
};

exports.down = async function down(knex) {
  // Rows with no hub on one side (a pathway plan) can't go back under NOT NULL.
  await knex("learner_transfers").whereNull("fromHubId").orWhereNull("toHubId").del();
  await knex.schema.alterTable("learner_transfers", (t) => {
    fk(t, "fromHubId").notNullable().alter();
    fk(t, "toHubId").notNullable().alter();
  });
  if (await knex.schema.hasColumn("learner_transfers", "toProgramme")) {
    await knex.schema.alterTable("learner_transfers", (t) => {
      t.dropColumn("fromProgramme");
      t.dropColumn("toProgramme");
      t.dropColumn("fromRecordId");
      t.dropColumn("toRecordId");
      t.dropColumn("fromLabel");
      t.dropColumn("toLabel");
    });
  }
};
