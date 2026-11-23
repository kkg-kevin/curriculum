const { id, fk, timestamps } = require("../helpers");

// The Timetable Planner (23 Nov 2026).
//
//   timetable_slots.dayOfWeek   + saturday, sunday: classes can run at weekends
//   timetable_slots.validFrom   the first date this version of the lesson applies (null = always)
//   timetable_slot_versions     how a lesson used to be, up to `validTo`. Changing or removing a
//                               lesson that has already run keeps its old day and time here, so the
//                               calendar, educator hours and claims for past sessions never move.
//
// timetable_slots stays "the lessons as they are now", so everything that reads the current weekly
// pattern carries on unchanged.
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const ALL_DAYS = [...WEEKDAYS, "saturday", "sunday"];
const enumSql = (values) => values.map((v) => `'${v}'`).join(", ");

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE timetable_slots MODIFY dayOfWeek ENUM(${enumSql(ALL_DAYS)}) NOT NULL`);
  if (!(await knex.schema.hasColumn("timetable_slots", "validFrom"))) {
    await knex.schema.alterTable("timetable_slots", (t) => { t.date("validFrom").nullable(); });
  }
  if (!(await knex.schema.hasTable("timetable_slot_versions"))) {
    await knex.schema.createTable("timetable_slot_versions", (t) => {
      id(t);
      fk(t, "slotId").notNullable();
      fk(t, "classId").notNullable();
      fk(t, "courseId").notNullable();
      fk(t, "teacherId").nullable();
      fk(t, "roomId").nullable();
      t.string("dayOfWeek", 9).notNullable();
      t.string("startTime", 5).notNullable();
      t.string("endTime", 5).notNullable();
      t.date("validFrom").nullable();
      t.date("validTo").notNullable();
      fk(t, "changedBy").nullable();
      timestamps(t);
      t.index("slotId");
      t.index("classId");
      t.index(["dayOfWeek", "validTo"]);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("timetable_slot_versions");
  if (await knex.schema.hasColumn("timetable_slots", "validFrom")) {
    await knex.schema.alterTable("timetable_slots", (t) => t.dropColumn("validFrom"));
  }
  await knex("timetable_slots").whereIn("dayOfWeek", ["saturday", "sunday"]).del();
  await knex.raw(`ALTER TABLE timetable_slots MODIFY dayOfWeek ENUM(${enumSql(WEEKDAYS)}) NOT NULL`);
};
