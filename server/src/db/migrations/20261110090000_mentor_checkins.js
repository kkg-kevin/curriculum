const { id, fk, timestamps } = require("../helpers");

// Parent–mentor check-ins (10 Nov 2026) — a class's educators meet each family of the class, one
// family at a time, about how their child is doing (modules/mentor-checkins/).
//
//   mentor_checkin_templates  the workspace's templates — the same as QA's and hub check-ins'
//                             (qa.rules.js): sections of yes / no, rubric and comment items.
//   mentor_checkin_rounds     one round = one class's check-ins: the hub, the class, its educators
//                             (all of them attend), online (link) or in person (place), the template,
//                             and the window the times were drawn from (dates, weekdays, hours,
//                             meeting length, gap). Status published | cancelled.
//   mentor_checkin_meetings   one per family (a parent's login) in the round — every child of
//                             theirs in the class in the one meeting (learnerIds). Its time
//                             (date + startTime / endTime, Kenyan time). `slotKey` ("date start")
//                             is UNIQUE per round, so two families can never hold the same time —
//                             it's cleared when a meeting is cancelled. The parent may confirm or
//                             pick another free time. The educators' report (template answers,
//                             score, summary and agreed actions), then the parent's approval.
//
// No DB-level foreign keys, as everywhere else in this schema (see helpers.js).
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("mentor_checkin_templates"))) {
    await knex.schema.createTable("mentor_checkin_templates", (table) => {
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

  if (!(await knex.schema.hasTable("mentor_checkin_rounds"))) {
    await knex.schema.createTable("mentor_checkin_rounds", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "hubId").notNullable();
      fk(table, "classId").notNullable();
      table.json("educatorIds").notNullable();
      fk(table, "templateId").nullable();
      table.string("format", 20).notNullable();
      table.string("meetingLink", 500).nullable();
      table.string("location", 255).nullable();
      table.date("windowStart").notNullable();
      table.date("windowEnd").notNullable();
      table.json("days").notNullable();
      table.string("dayStart", 5).notNullable();
      table.string("dayEnd", 5).notNullable();
      table.integer("minutes").notNullable();
      table.integer("gapMinutes").notNullable().defaultTo(0);
      table.string("spread", 20).notNullable().defaultTo("spread");
      table.string("status", 20).notNullable().defaultTo("published");
      table.datetime("cancelledAt").nullable();
      fk(table, "createdBy").nullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
      table.index("classId");
      table.index("hubId");
      table.index("templateId");
    });
  }

  if (!(await knex.schema.hasTable("mentor_checkin_meetings"))) {
    await knex.schema.createTable("mentor_checkin_meetings", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "roundId").notNullable();
      fk(table, "hubId").notNullable();
      fk(table, "classId").notNullable();
      fk(table, "parentUserId").notNullable();
      table.json("learnerIds").notNullable();
      table.date("date").notNullable();
      table.string("startTime", 5).notNullable();
      table.string("endTime", 5).notNullable();
      table.string("slotKey", 20).nullable();
      table.string("status", 20).notNullable().defaultTo("scheduled");
      table.datetime("confirmedAt").nullable();
      table.datetime("parentChangedAt").nullable();
      table.json("template").nullable();
      table.json("answers").nullable();
      table.decimal("score", 5, 1).nullable();
      table.json("sectionScores").nullable();
      table.json("report").nullable();
      table.datetime("reportSubmittedAt").nullable();
      fk(table, "reportSubmittedBy").nullable();
      table.datetime("approvedAt").nullable();
      table.text("parentComment").nullable();
      table.string("remindedFor", 20).nullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
      table.unique(["roundId", "parentUserId"]);
      table.unique(["roundId", "slotKey"]);
      table.index(["ownerAdminId", "date"]);
      table.index("parentUserId");
      table.index(["status", "date"]);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("mentor_checkin_meetings");
  await knex.schema.dropTableIfExists("mentor_checkin_rounds");
  await knex.schema.dropTableIfExists("mentor_checkin_templates");
};
