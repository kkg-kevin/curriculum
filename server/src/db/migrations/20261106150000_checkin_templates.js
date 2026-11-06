const { id, fk, timestamps } = require("../helpers");

// Templates for hub check-ins (6 Nov 2026) — the same as quality assurance templates (qa.rules.js):
// sections of items answered yes / no, on the template's rubric scale, or with a comment, a
// description and guidance per item, a score worked out the same way.
//
//   checkin_templates   the workspace's templates, made by check-in managers (archived, not
//                       deleted, once used — reports keep their own copy).
//   checkin_schedules.templateId   the template a schedule's check-ins use (optional — none keeps
//                       the report to highs, lows and resolutions).
//   checkin_sessions    templateId (from its schedule), and once its report is in: its own copy of
//                       the template (`template`), the `answers`, the `score` and `sectionScores`.
//                       Highs, lows and resolutions stay in `report`.
//
// No DB-level foreign keys, as everywhere else in this schema (see helpers.js).
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("checkin_templates"))) {
    await knex.schema.createTable("checkin_templates", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.string("name", 150).notNullable();
      table.text("description").nullable();
      table.json("scale").nullable();
      table.json("sections").notNullable();
      table.string("status", 20).notNullable().defaultTo("active");
      fk(table, "createdBy").nullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
    });
  }
  if (!(await knex.schema.hasColumn("checkin_schedules", "templateId"))) {
    await knex.schema.alterTable("checkin_schedules", (table) => {
      fk(table, "templateId").nullable();
      table.index("templateId");
    });
  }
  if (!(await knex.schema.hasColumn("checkin_sessions", "templateId"))) {
    await knex.schema.alterTable("checkin_sessions", (table) => {
      fk(table, "templateId").nullable();
      table.json("template").nullable();
      table.json("answers").nullable();
      table.decimal("score", 5, 1).nullable();
      table.json("sectionScores").nullable();
      table.index("templateId");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("checkin_sessions", "templateId")) {
    await knex.schema.alterTable("checkin_sessions", (table) => {
      table.dropIndex("templateId");
      table.dropColumn("templateId");
      table.dropColumn("template");
      table.dropColumn("answers");
      table.dropColumn("score");
      table.dropColumn("sectionScores");
    });
  }
  if (await knex.schema.hasColumn("checkin_schedules", "templateId")) {
    await knex.schema.alterTable("checkin_schedules", (table) => {
      table.dropIndex("templateId");
      table.dropColumn("templateId");
    });
  }
  await knex.schema.dropTableIfExists("checkin_templates");
};
