const { id, fk, timestamps } = require("../helpers");

// A teacher's one-off "we didn't hold this session" record — see timetable.service.js's
// resolveCoursePlacements for how this plugs into the read-time calendar walk. courseId is
// load-bearing (not redundant with sessionId): the resolver needs to check "is there a skip on
// this date" before it knows which session would land there — session identity only comes from
// indexing the course's session list, which hasn't happened yet at that point in the walk.
// sessionId is denormalized purely for display (audit trail / undo UI).
exports.up = async function up(knex) {
  await knex.schema.createTable("timetable_session_skips", (table) => {
    id(table);
    fk(table, "classId").notNullable();
    fk(table, "courseId").notNullable();
    table.date("date").notNullable();
    fk(table, "sessionId").notNullable();
    table.enu("mode", ["shift", "merge"]).notNullable();
    table.string("reason", 300).nullable();
    fk(table, "createdBy").nullable();
    // create-then-delete only ("undo" is a delete, not an edit) — same posture as
    // class_group_members, no updatedAt needed.
    timestamps(table, { updatedAt: false });
    table.unique(["classId", "courseId", "date"]);
    table.index("classId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("timetable_session_skips");
};
