const { fk } = require("../helpers");

// A third reschedule mode alongside "shift"/"merge" — "move" relocates a session to an explicit
// date the teacher picks, independent of the class's normal weekly slot pattern (unlike
// shift/merge, which only ever change what happens at the ORIGIN date within that pattern). The
// new columns snapshot the session's own time/room/teacher at the moment of the move, since the
// target date may not correspond to any of the course's configured weekday slots at all — see
// resolveCoursePlacements in timetable.service.js for how these get read back at calendar time.
exports.up = async function up(knex) {
  await knex.schema.alterTable("timetable_session_skips", (table) => {
    table.date("newDate").nullable();
    table.string("startTime", 5).nullable();
    table.string("endTime", 5).nullable();
    fk(table, "roomId").nullable();
    fk(table, "teacherId").nullable();
    // NULL newDate (every existing shift/merge row) never collides under a composite unique
    // index — MySQL treats each NULL as distinct — so this only ever blocks two different
    // sessions of the same course being moved onto the same target date.
    table.unique(["classId", "courseId", "newDate"]);
  });
  // Knex has no cross-dialect "alter enum" helper; MySQL requires the column redefined outright.
  await knex.raw("ALTER TABLE `timetable_session_skips` MODIFY `mode` ENUM('shift', 'merge', 'move') NOT NULL");
};

exports.down = async function down(knex) {
  await knex.raw("ALTER TABLE `timetable_session_skips` MODIFY `mode` ENUM('shift', 'merge') NOT NULL");
  await knex.schema.alterTable("timetable_session_skips", (table) => {
    table.dropUnique(["classId", "courseId", "newDate"]);
    table.dropColumn("newDate");
    table.dropColumn("startTime");
    table.dropColumn("endTime");
    table.dropColumn("roomId");
    table.dropColumn("teacherId");
  });
};
