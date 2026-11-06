const { id, fk, timestamps } = require("../helpers");

// Who takes part in a hub's check-ins, and the online meeting link (6 Nov 2026).
//
//   checkin_schedules.participants   [{ userId, kind }] — chosen when the check-ins are set up:
//                                    kind "team" (our admins and staff), "hub" (the hub's own login),
//                                    "mentor" (an educator of the hub) or "parent" (a parent of a
//                                    learner at the hub). The Account Manager and Training Lead
//                                    still run each check-in and write its report.
//   checkin_schedules.meetingLink    the link to join an online check-in (Meet, Zoom, Teams…).
//   checkin_sessions.meetingLink     copied from the schedule onto each check-in.
//   checkin_participants             one row per (check-in, person), copied from the schedule as each
//                                    check-in is put on the calendar (UNIQUE sessionId + userId) — who
//                                    is told it's coming, gets the pop-up, and gets the report.
//
// No DB-level foreign keys, as everywhere else in this schema (see helpers.js).
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("checkin_schedules", "participants"))) {
    await knex.schema.alterTable("checkin_schedules", (table) => {
      table.json("participants").nullable();
      table.string("meetingLink", 500).nullable();
    });
  }
  if (!(await knex.schema.hasColumn("checkin_sessions", "meetingLink"))) {
    await knex.schema.alterTable("checkin_sessions", (table) => {
      table.string("meetingLink", 500).nullable();
    });
  }
  if (!(await knex.schema.hasTable("checkin_participants"))) {
    await knex.schema.createTable("checkin_participants", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "sessionId").notNullable();
      fk(table, "userId").notNullable();
      table.string("kind", 20).notNullable();
      timestamps(table);
      table.unique(["sessionId", "userId"]);
      table.index("userId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("checkin_participants");
  if (await knex.schema.hasColumn("checkin_sessions", "meetingLink")) {
    await knex.schema.alterTable("checkin_sessions", (table) => table.dropColumn("meetingLink"));
  }
  if (await knex.schema.hasColumn("checkin_schedules", "participants")) {
    await knex.schema.alterTable("checkin_schedules", (table) => {
      table.dropColumn("participants");
      table.dropColumn("meetingLink");
    });
  }
};
