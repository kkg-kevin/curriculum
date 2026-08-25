const { id, fk, timestamps } = require("../helpers");

// A teacher's own declared "I can teach during these windows" — a weekly recurring pattern,
// same shape as timetable_slots' own dayOfWeek/startTime/endTime, just without a class/course/
// room attached. Purely opt-in: a teacher with zero rows here imposes no scheduling restriction
// at all (see timetable.service.js's hasConflict), same "unconfigured = unrestricted" posture
// academic-year periods already use for isDateSchedulable.
exports.up = async function up(knex) {
  await knex.schema.createTable("teacher_availability_slots", (table) => {
    id(table);
    fk(table, "teacherId").notNullable();
    table.enu("dayOfWeek", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNullable();
    table.string("startTime", 5).notNullable();
    table.string("endTime", 5).notNullable();
    timestamps(table);
    table.index("teacherId");
    table.index("dayOfWeek");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("teacher_availability_slots");
};
