const { id, fk, timestamps } = require("../helpers");

// The concrete instance of a curriculum Session for one class on one real calendar date — the
// durable record the read-time scheduling engine (timetable.service.js's resolveCoursePlacements)
// never had. That engine stays the source of truth for *where* a session falls: this table is
// upserted lazily from its output (see SessionOccurrenceService.syncClassOccurrences) purely to
// give class-completion tracking somewhere to hang per-session state — "was it taught", "was
// attendance dealt with" — that a pure recompute can't hold.
//
// Identity is (classId, sessionId, date), not (classId, courseId, sessionId): a class only ever
// runs one session on a given date in practice, and attendance is already keyed by (classId,
// date) alone (attendance.model.js), so pinning the occurrence to the same pair keeps the two
// aligned. courseId is denormalised for cheap filtering ("every occurrence in this course")
// without a session lookup, same reasoning session_skips keeps courseId alongside sessionId.
//
// No rows are backfilled. A class mid-year simply has no occurrences for dates already passed
// until its calendar is next resolved, at which point every past date gets one — completion
// tracking is forward-looking and a class that finished before this shipped was never gated on it.
exports.up = async function up(knex) {
  await knex.schema.createTable("session_occurrences", (table) => {
    id(table);
    fk(table, "classId").notNullable();
    fk(table, "courseId").notNullable();
    fk(table, "sessionId").notNullable();
    table.date("date").notNullable();

    // scheduled  — the engine placed it here; nothing has happened yet (or the date is future).
    // taught     — a teacher/admin confirmed the session was delivered.
    // cancelled  — confirmed it was NOT delivered and won't be (distinct from a skip, which
    //              *reschedules* the session onto another date; a cancelled occurrence is a
    //              hole the class consciously accepts). Counts as "resolved" for completion.
    table.enu("status", ["scheduled", "taught", "cancelled"]).notNullable().defaultTo("scheduled");
    table.datetime("taughtAt").nullable();
    fk(table, "taughtBy").nullable();

    // not_taken          — no attendance rows exist for this (classId, date) and it hasn't been
    //                      consciously closed.
    // taken              — attendance was marked (attendance.service.js write-once).
    // locked_not_marked  — a teacher/admin (or the auto-lock sweep) closed the session out
    //                      without attendance ever being marked. A deliberate terminal state,
    //                      NOT missing data — this is what lets the completion check tell
    //                      "closed unmarked" apart from "still open".
    table.enu("attendanceState", ["not_taken", "taken", "locked_not_marked"]).notNullable().defaultTo("not_taken");
    table.datetime("attendanceLockedAt").nullable();
    fk(table, "attendanceLockedBy").nullable();

    // Free-text note a teacher can leave when marking taught / cancelling / locking — e.g. why a
    // session was cancelled, or that attendance was on paper. Audit context only.
    table.string("note", 500).nullable();

    timestamps(table);
    table.unique(["classId", "sessionId", "date"]);
    table.index("classId");
    table.index(["classId", "courseId"]);
    table.index(["classId", "date"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("session_occurrences");
};
