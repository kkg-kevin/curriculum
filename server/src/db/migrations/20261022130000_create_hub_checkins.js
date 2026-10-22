const { id, fk, timestamps } = require("../helpers");

// Hub check-ins (modules/checkins/): regular check-ins with each hub by an Account Manager and a
// Training Lead — staff logins given those roles — scheduled, reported on, and followed up.
//
//   checkin_schedules       one per recurring (or one-off) arrangement: hub, the two staff, how
//                           often, when, how long, online/in person, agenda.
//   checkin_sessions        one per occurrence, generated from its schedule ahead of time. UNIQUE
//                           (scheduleId, occurrenceDate) — the date the schedule put it on — so
//                           generating twice never makes a second copy. Each keeps its own status,
//                           report (JSON: sections A–D, F notes and G of the report form), history,
//                           and staff, so editing or ending a schedule never rewrites a session that
//                           has been worked on. Dates are Kenyan calendar dates ("YYYY-MM-DD") and
//                           times "HH:MM", with no timezone conversion.
//   checkin_actions         an issue raised or a follow-up agreed at a check-in, tracked on its own
//                           (assignee, due date, status, escalation, resolution) — completing a
//                           check-in never closes its actions.
//   checkin_action_updates  every change to an action (append-only), its history.
//
// No DB-level foreign keys, as everywhere else in this schema (see helpers.js).
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("checkin_schedules"))) {
    await knex.schema.createTable("checkin_schedules", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "hubId").notNullable();
      fk(table, "accountManagerId").nullable();
      fk(table, "trainingLeadId").nullable();
      table.string("frequency", 20).notNullable();
      table.date("startDate").notNullable();
      table.date("endDate").nullable();
      // Sessions are only ever generated on or after this date: when the schedule was set up (or
      // its timing last changed) — never back-filled into the past.
      table.date("generateFrom").notNullable();
      table.string("startTime", 5).notNullable();
      table.integer("durationMinutes").nullable();
      table.string("format", 20).notNullable();
      table.string("meetingLink", 500).nullable();
      table.string("venue", 255).nullable();
      table.text("agenda").nullable();
      table.string("status", 20).notNullable().defaultTo("active");
      fk(table, "createdBy").nullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
      table.index("hubId");
    });
  }

  if (!(await knex.schema.hasTable("checkin_sessions"))) {
    await knex.schema.createTable("checkin_sessions", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "scheduleId").notNullable();
      fk(table, "hubId").notNullable();
      table.date("occurrenceDate").notNullable();
      table.date("scheduledDate").notNullable();
      table.string("startTime", 5).notNullable();
      table.integer("durationMinutes").nullable();
      table.string("format", 20).notNullable();
      table.string("meetingLink", 500).nullable();
      table.string("venue", 255).nullable();
      table.text("agenda").nullable();
      fk(table, "accountManagerId").nullable();
      fk(table, "trainingLeadId").nullable();
      table.string("status", 30).notNullable().defaultTo("scheduled");
      table.string("reportStatus", 20).notNullable().defaultTo("none");
      table.json("report").nullable();
      table.string("overallStatus", 30).nullable();
      table.datetime("reportSubmittedAt").nullable();
      fk(table, "reportSubmittedBy").nullable();
      table.string("cancelReason", 255).nullable();
      table.json("history").nullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
      table.unique(["scheduleId", "occurrenceDate"]);
      table.index(["ownerAdminId", "scheduledDate"]);
      table.index(["ownerAdminId", "status"]);
      table.index("hubId");
      table.index("accountManagerId");
      table.index("trainingLeadId");
    });
  }

  if (!(await knex.schema.hasTable("checkin_actions"))) {
    await knex.schema.createTable("checkin_actions", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "hubId").notNullable();
      fk(table, "sessionId").notNullable();
      table.string("kind", 20).notNullable().defaultTo("action");
      table.string("title", 200).notNullable();
      table.text("description").nullable();
      table.text("impact").nullable();
      table.boolean("recurring").notNullable().defaultTo(false);
      table.string("category", 40).notNullable();
      table.string("priority", 20).notNullable().defaultTo("medium");
      fk(table, "assigneeId").nullable();
      table.date("dueDate").nullable();
      table.string("status", 20).notNullable().defaultTo("open");
      table.text("resolutionNotes").nullable();
      table.datetime("resolvedAt").nullable();
      fk(table, "resolvedBy").nullable();
      table.datetime("closedAt").nullable();
      table.datetime("escalatedAt").nullable();
      fk(table, "escalatedBy").nullable();
      table.string("escalationNote", 500).nullable();
      fk(table, "createdBy").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
      table.index("hubId");
      table.index("sessionId");
      table.index("assigneeId");
      table.index("dueDate");
    });
  }

  if (!(await knex.schema.hasTable("checkin_action_updates"))) {
    await knex.schema.createTable("checkin_action_updates", (table) => {
      id(table);
      fk(table, "actionId").notNullable();
      fk(table, "userId").nullable();
      table.string("userName", 190).nullable();
      table.string("kind", 30).notNullable();
      table.string("fromStatus", 20).nullable();
      table.string("toStatus", 20).nullable();
      table.text("note").nullable();
      timestamps(table, { updatedAt: false });
      table.index("actionId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("checkin_action_updates");
  await knex.schema.dropTableIfExists("checkin_actions");
  await knex.schema.dropTableIfExists("checkin_sessions");
  await knex.schema.dropTableIfExists("checkin_schedules");
};
