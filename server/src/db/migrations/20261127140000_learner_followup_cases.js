const { id, fk } = require("../helpers");

// Follow-ups as cases (26 Nov 2026 — modules/analytics/analytics.cases.js). A learner the figures
// flag (the four at-risk reasons, absences in a row, a skill they're stuck on, reports their parent
// hasn't opened) gets a CASE: who looks after it (by default the class's educator), a due date,
// where it stands (open → contacted → plan agreed → resolved, or escalated to the admins), and a
// re-check 14 days on that closes it as "back on track" when the reason has gone.
//   learner_followup_cases   one per learner per reason while open (`openKey` UNIQUE, cleared on
//                            closing — so the same reason can open again later)
//   learner_followups.caseId every action and note on a case (the at-risk list's actions too)
//   learner_followup_runs    when each workspace was last checked (once a day is enough)
// New tables have a newer collation than the older ones — never SQL-join them to older tables.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("learner_followup_cases"))) {
    await knex.schema.createTable("learner_followup_cases", (t) => {
      id(t);
      fk(t, "ownerAdminId").notNullable();
      fk(t, "hubId").nullable();
      fk(t, "classId").nullable();
      fk(t, "learnerId").notNullable();
      t.string("reason", 30).notNullable();
      t.string("reasonKey", 80).notNullable();
      t.string("openKey", 130).nullable().unique();
      t.json("details").nullable();
      t.string("status", 16).notNullable().defaultTo("open"); // open | contacted | plan | escalated | resolved
      fk(t, "ownerUserId").nullable(); // null = the workspace's admins
      t.string("ownerName", 150).nullable();
      t.date("dueOn").nullable();
      t.date("recheckOn").nullable();
      t.boolean("stillFlagged").notNullable().defaultTo(true);
      t.json("lastCheck").nullable();
      t.string("outcome", 20).nullable(); // back_on_track | sorted | left
      t.string("outcomeNote", 1000).nullable();
      t.string("source", 10).notNullable().defaultTo("auto"); // auto | manual
      fk(t, "openedBy").nullable();
      t.datetime("openedAt").notNullable();
      t.datetime("resolvedAt").nullable();
      t.datetime("createdAt").notNullable();
      t.datetime("updatedAt").nullable();
      t.index(["ownerAdminId", "status"]);
      t.index(["learnerId"]);
      t.index(["ownerUserId", "status"]);
    });
  }
  if (!(await knex.schema.hasColumn("learner_followups", "caseId"))) {
    await knex.schema.alterTable("learner_followups", (t) => {
      fk(t, "caseId").nullable();
      t.index(["caseId"]);
    });
  }
  if (!(await knex.schema.hasTable("learner_followup_runs"))) {
    await knex.schema.createTable("learner_followup_runs", (t) => {
      fk(t, "ownerAdminId").primary();
      t.datetime("lastRunAt").notNullable();
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("learner_followup_runs");
  await knex.schema.dropTableIfExists("learner_followup_cases");
  if (await knex.schema.hasColumn("learner_followups", "caseId")) {
    await knex.schema.alterTable("learner_followups", (t) => t.dropColumn("caseId"));
  }
};
