const { fk } = require("../helpers");

// Mentor standards (10 Nov 2026) — modules/mentor-standards/.
//
//   mentor_standard_settings   one row per workspace: the standards switched on, each one's target,
//                              minimum and the evidence it needs, the new mentors' grace period, and
//                              whether falling below is notified. Missing → the defaults
//                              (mentor-standards.rules.js).
//   mentor_standard_snapshots  each mentor's standing, kept once a month (the current month's row is
//                              updated as it goes), so a trend can be shown — and changing a target
//                              later never rewrites how a mentor stood then.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("mentor_standard_settings"))) {
    await knex.schema.createTable("mentor_standard_settings", (table) => {
      fk(table, "ownerAdminId").notNullable().primary();
      table.json("settings").notNullable();
      fk(table, "updatedBy").nullable();
      table.datetime("updatedAt").notNullable();
    });
  }
  if (!(await knex.schema.hasTable("mentor_standard_snapshots"))) {
    await knex.schema.createTable("mentor_standard_snapshots", (table) => {
      fk(table, "teacherId").notNullable();
      table.string("month", 7).notNullable();
      fk(table, "ownerAdminId").nullable();
      table.json("standing").notNullable();
      table.datetime("updatedAt").notNullable();
      table.primary(["teacherId", "month"]);
      table.index("ownerAdminId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("mentor_standard_snapshots");
  await knex.schema.dropTableIfExists("mentor_standard_settings");
};
