const { id, fk, timestamps } = require("../helpers");

// Quality assurance (modules/qa/): a supervisor (or an admin) visits an educator, checks how they
// teach against a template, and writes a report the educator can reply to.
//
//   qa_templates  what is checked, made by a supervisor or an admin and shared by the workspace:
//                 sections of criteria (JSON), each answered yes / no, on the template's rubric
//                 scale (`scale`), or with a comment. Archived, not deleted, once used.
//   qa_schedules  regular visits to one educator: how often, from when, announced or a surprise,
//                 which template, who reviews. Visits are generated from it ahead of time.
//   qa_visits     one visit — from a schedule (UNIQUE scheduleId + occurrenceDate, so generating
//                 again never makes a second) or planned on its own. Keeps its own copy of the
//                 template once the review is started, so editing a template never changes a
//                 report. An announced visit is shown to the educator and the hub beforehand; a
//                 surprise one only once its report is in. Dates are Kenyan calendar dates.
//
// No DB-level foreign keys, as everywhere else in this schema (see helpers.js).
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("qa_templates"))) {
    await knex.schema.createTable("qa_templates", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.string("name", 150).notNullable();
      table.text("description").nullable();
      // The rubric's levels, shared by every rubric criterion of the template ([{ score, label }]).
      table.json("scale").nullable();
      table.json("sections").notNullable();
      table.string("status", 20).notNullable().defaultTo("active");
      fk(table, "createdBy").nullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
    });
  }

  if (!(await knex.schema.hasTable("qa_schedules"))) {
    await knex.schema.createTable("qa_schedules", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "teacherId").notNullable();
      fk(table, "hubId").nullable();
      fk(table, "templateId").notNullable();
      fk(table, "reviewerId").notNullable();
      table.string("frequency", 20).notNullable();
      table.string("visitType", 20).notNullable();
      table.date("startDate").notNullable();
      table.date("endDate").nullable();
      // Visits are only ever generated on or after this date — never back-filled into the past.
      table.date("generateFrom").notNullable();
      table.string("status", 20).notNullable().defaultTo("active");
      fk(table, "createdBy").nullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
      table.index("teacherId");
      table.index("reviewerId");
    });
  }

  if (!(await knex.schema.hasTable("qa_visits"))) {
    await knex.schema.createTable("qa_visits", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "scheduleId").nullable();
      table.date("occurrenceDate").nullable();
      table.date("scheduledDate").notNullable();
      fk(table, "teacherId").notNullable();
      fk(table, "hubId").nullable();
      fk(table, "templateId").notNullable();
      fk(table, "reviewerId").notNullable();
      table.string("visitType", 20).notNullable();
      // open → submitted, or cancelled. A review saved without sending is still open.
      table.string("status", 20).notNullable().defaultTo("open");
      table.json("template").nullable();
      table.json("answers").nullable();
      table.json("summary").nullable();
      table.decimal("score", 5, 1).nullable();
      table.json("sectionScores").nullable();
      table.datetime("startedAt").nullable();
      table.datetime("submittedAt").nullable();
      fk(table, "submittedBy").nullable();
      table.text("reply").nullable();
      table.datetime("repliedAt").nullable();
      // The date the educator was last told about this (announced) visit — a new date tells them again.
      table.date("noticeSentFor").nullable();
      fk(table, "createdBy").nullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
      table.unique(["scheduleId", "occurrenceDate"]);
      table.index(["ownerAdminId", "scheduledDate"]);
      table.index(["ownerAdminId", "status"]);
      table.index("teacherId");
      table.index("hubId");
      table.index("reviewerId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("qa_visits");
  await knex.schema.dropTableIfExists("qa_schedules");
  await knex.schema.dropTableIfExists("qa_templates");
};
