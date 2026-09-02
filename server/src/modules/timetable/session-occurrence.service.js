const SessionOccurrenceModel = require("./session-occurrence.model");
const CourseScheduleModel = require("./course-schedule.model");
const AttendanceModel = require("../attendance/attendance.model");
const ClassModel = require("../classes/class.model");
const SessionModel = require("../courses/session.model");
const CourseModel = require("../courses/course.model");

// How long after a session's date an un-marked attendance auto-locks. A teacher gets this many
// days to go back and record (on paper, from memory) before the occurrence is closed as
// locked_not_marked so a forgotten session can't block class completion forever. Deliberately
// generous — the lock is recoverable-by-admin-override only, so erring long is safer than short.
const ATTENDANCE_AUTOLOCK_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

// Same "today as a plain YYYY-MM-DD, walked in UTC" convention attendance.service.js and
// program.service.js already use — client and server agree on where the day boundary is.
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n) {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
}

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  throw err;
}

function conflict(message) {
  const err = new Error(message);
  err.statusCode = 409;
  throw err;
}

const SessionOccurrenceService = {
  ATTENDANCE_AUTOLOCK_DAYS,

  // Reconciles the session_occurrences rows for one class against what the read-time scheduling
  // engine currently says its calendar looks like, up to (and including) today. Idempotent and
  // safe to call on every calendar read / completion check — it only ever:
  //   1. inserts an occurrence for a (sessionId, date) the engine now places in the past that
  //      has no row yet,
  //   2. flips attendanceState not_taken -> taken once attendance rows exist for that date,
  //   3. auto-locks occurrences whose date is >ATTENDANCE_AUTOLOCK_DAYS old and still not_taken.
  // It never deletes or moves an existing occurrence: once a date is on record as having run,
  // later edits to the timetable (a new skip, a shifted anchor) don't retroactively un-happen it.
  // A future-dated placement is deliberately NOT persisted — nothing has happened there yet, and
  // the engine remains the sole source of truth for the forward calendar.
  //
  // `resolveCalendar` is passed in by the caller rather than required at module top level to
  // avoid a require cycle: timetable.service.js already requires this module for its own
  // getSessionSummary/getSessionStatusBulk, so the reverse edge can't be a static require.
  async syncClassOccurrences(classId, resolveCalendar) {
    const cls = await ClassModel.findById(classId);
    if (!cls) return [];

    const today = todayStr();
    const anchors = await CourseScheduleModel.findByClassId(classId);
    if (anchors.length === 0) {
      // No course has a start-date anchor yet — nothing the engine would place, so nothing to
      // sync. Still run the sweep in case earlier occurrences exist from before anchors changed.
      await SessionOccurrenceService._runAutolockSweep(classId);
      return SessionOccurrenceModel.findByClassId(classId);
    }
    const earliestAnchor = anchors.reduce((min, a) => (a.startDate < min ? a.startDate : min), anchors[0].startDate);

    // Only ever ask the engine for [earliest anchor .. today] — past placements are all we
    // persist, and a class that's been running for years still only needs its own span walked.
    const { events } = await resolveCalendar({ classId, from: earliestAnchor, to: today });
    const pastEvents = events.filter((e) => e.date <= today);

    const existing = await SessionOccurrenceModel.findByClassId(classId);
    const existingKey = new Set(existing.map((o) => `${o.sessionId}:${o.date}`));

    const toCreate = pastEvents
      .filter((e) => !existingKey.has(`${e.sessionId}:${e.date}`))
      .map((e) => ({ classId, courseId: e.courseId, sessionId: e.sessionId, date: e.date }));

    let created = [];
    if (toCreate.length) {
      try {
        created = await SessionOccurrenceModel.bulkCreate(toCreate);
      } catch (err) {
        // A concurrent sync beat us to some/all of these — the unique index rejected the batch.
        // Fall back to per-row inserts so the ones that AREN'T dupes still land.
        if (err.code !== "ER_DUP_ENTRY") throw err;
        for (const row of toCreate) {
          try {
            created.push(await SessionOccurrenceModel.create(row));
          } catch (e) {
            if (e.code !== "ER_DUP_ENTRY") throw e;
          }
        }
      }
    }

    await SessionOccurrenceService._syncAttendanceTaken(classId, [...existing, ...created]);
    await SessionOccurrenceService._runAutolockSweep(classId);

    return SessionOccurrenceModel.findByClassId(classId);
  },

  // Flips not_taken -> taken for any occurrence whose (classId, date) now has attendance rows.
  // One-directional: attendance being deleted (which the app never does) wouldn't un-set this,
  // matching attendance's own write-once posture.
  async _syncAttendanceTaken(classId, occurrences) {
    const stillOpen = occurrences.filter((o) => o.attendanceState === "not_taken");
    if (!stillOpen.length) return;
    const dates = [...new Set(stillOpen.map((o) => o.date))];
    const marked = new Set();
    await Promise.all(
      dates.map(async (date) => {
        const rows = await AttendanceModel.findByClassAndDate(classId, date);
        if (rows.length > 0) marked.add(date);
      })
    );
    const ids = stillOpen.filter((o) => marked.has(o.date)).map((o) => o.id);
    if (ids.length) await SessionOccurrenceModel.setAttendanceState(ids, "taken");
  },

  // Closes out every occurrence in the class older than the auto-lock window that never had
  // attendance marked. Runs lazily off calendar reads / completion checks rather than a cron —
  // same "no background jobs, sweep on the natural trigger" posture as revoked-token cleanup.
  async _runAutolockSweep(classId) {
    const cutoff = daysAgoStr(ATTENDANCE_AUTOLOCK_DAYS);
    const stale = await SessionOccurrenceModel.findStaleUnmarked(cutoff, classId);
    if (!stale.length) return;
    // Re-check attendance one more time before locking — a teacher may have marked it on the
    // session day and _syncAttendanceTaken simply hasn't run for that date since.
    const byDate = new Map();
    await Promise.all(
      [...new Set(stale.map((o) => o.date))].map(async (date) => {
        const rows = await AttendanceModel.findByClassAndDate(classId, date);
        byDate.set(date, rows.length > 0);
      })
    );
    const nowMarked = stale.filter((o) => byDate.get(o.date)).map((o) => o.id);
    const toLock = stale.filter((o) => !byDate.get(o.date)).map((o) => o.id);
    if (nowMarked.length) await SessionOccurrenceModel.setAttendanceState(nowMarked, "taken");
    if (toLock.length) {
      await SessionOccurrenceModel.setAttendanceState(toLock, "locked_not_marked", {
        attendanceLockedAt: new Date(),
        attendanceLockedBy: null, // null actor = the automatic sweep, not a person
      });
    }
  },

  async listForClass(classId) {
    return SessionOccurrenceModel.findByClassId(classId);
  },

  // The class's occurrences (synced first), each hydrated with its session title/order and
  // course name for display — the source the class-detail "sessions" tab / completion panel
  // renders row-by-row. Sorted by date, oldest first, same as the model's own ordering.
  async listForClassHydrated(classId, resolveCalendar) {
    const occ = await SessionOccurrenceService.syncClassOccurrences(classId, resolveCalendar);
    const sessionIds = [...new Set(occ.map((o) => o.sessionId))];
    const courseIds = [...new Set(occ.map((o) => o.courseId))];
    const sessions = await Promise.all(sessionIds.map((id) => SessionModel.findById(id)));
    const courses = await Promise.all(courseIds.map((id) => CourseModel.findById(id)));
    const sessionById = new Map(sessions.filter(Boolean).map((s) => [s.id, s]));
    const courseById = new Map(courses.filter(Boolean).map((c) => [c.id, c]));
    return occ.map((o) => ({
      ...o,
      sessionTitle: sessionById.get(o.sessionId)?.title || null,
      sessionOrder: sessionById.get(o.sessionId)?.order ?? null,
      courseName: courseById.get(o.courseId)?.name || null,
    }));
  },

  // --- Manual close-out actions (teacher / admin) -------------------------------------------

  // "We delivered this session." Allowed only for a date that has actually passed (or is today)
  // — you can't pre-confirm a future session. Idempotent: re-marking an already-taught
  // occurrence just refreshes the note/attribution.
  async markTaught(occurrenceId, { actorId, note } = {}) {
    const occ = await SessionOccurrenceModel.findById(occurrenceId);
    if (!occ) notFound("Session occurrence not found");
    if (occ.date > todayStr()) conflict("This session hasn't happened yet — it can't be marked as taught.");
    if (occ.status === "cancelled") conflict("This session was cancelled — reopen it before marking it taught.");
    return SessionOccurrenceModel.update(occurrenceId, {
      status: "taught",
      taughtAt: occ.taughtAt || new Date(),
      taughtBy: actorId || occ.taughtBy || null,
      note: note ?? occ.note,
    });
  },

  // "This session did not run and won't be made up." Distinct from a session *skip*, which
  // reschedules — a cancel is a hole the class accepts. Counts as resolved for completion.
  async cancel(occurrenceId, { actorId, note } = {}) {
    const occ = await SessionOccurrenceModel.findById(occurrenceId);
    if (!occ) notFound("Session occurrence not found");
    if (occ.status === "taught") conflict("This session is already marked as taught.");
    return SessionOccurrenceModel.update(occurrenceId, {
      status: "cancelled",
      taughtBy: actorId || occ.taughtBy || null,
      note: note ?? occ.note,
    });
  },

  // Undo a taught/cancelled back to scheduled — an admin correcting a mis-click. Attendance
  // state is left untouched (it reflects real attendance data, independent of this flag).
  async reopen(occurrenceId, { actorId } = {}) {
    const occ = await SessionOccurrenceModel.findById(occurrenceId);
    if (!occ) notFound("Session occurrence not found");
    return SessionOccurrenceModel.update(occurrenceId, { status: "scheduled", taughtAt: null, taughtBy: actorId || null });
  },

  // "Close this session's attendance as never-marked" — the manual counterpart to the auto-lock
  // sweep, for a teacher/admin who knows attendance won't be coming. Refuses if attendance
  // actually exists (nothing to lock) or the date is still in the future.
  async lockAttendanceUnmarked(occurrenceId, { actorId, note } = {}) {
    const occ = await SessionOccurrenceModel.findById(occurrenceId);
    if (!occ) notFound("Session occurrence not found");
    if (occ.attendanceState === "taken") conflict("Attendance was already recorded for this session.");
    if (occ.date > todayStr()) conflict("This session hasn't happened yet.");
    const rows = await AttendanceModel.findByClassAndDate(occ.classId, occ.date);
    if (rows.length > 0) {
      await SessionOccurrenceModel.update(occurrenceId, { attendanceState: "taken" });
      conflict("Attendance was already recorded for this session.");
    }
    return SessionOccurrenceModel.update(occurrenceId, {
      attendanceState: "locked_not_marked",
      attendanceLockedAt: new Date(),
      attendanceLockedBy: actorId || null,
      note: note ?? occ.note,
    });
  },

  // Admin-only escape hatch: reopen a locked attendance so it can actually be marked. Doesn't
  // itself let a past date be marked (attendance.service.js still guards that) — it exists for
  // the case where the lock was wrong and an admin is correcting the record another way.
  async unlockAttendance(occurrenceId) {
    const occ = await SessionOccurrenceModel.findById(occurrenceId);
    if (!occ) notFound("Session occurrence not found");
    if (occ.attendanceState !== "locked_not_marked") conflict("This session's attendance isn't locked.");
    return SessionOccurrenceModel.update(occurrenceId, {
      attendanceState: "not_taken",
      attendanceLockedAt: null,
      attendanceLockedBy: null,
    });
  },

  // --- Completion aggregation --------------------------------------------------------------

  // The per-metric completion breakdown for one class, covering metrics 1 (sessions taught) and
  // 3 (attendance closed to the last session). Metrics 2 & 4 (grading + reports) come from
  // ReportService.getReadinessForClassCourses — kept there so this stays a pure occurrence
  // aggregator and the two don't drift. Caller (ClassService.getCompletionStatus) stitches them.
  //
  // Runs the sync first so the numbers reflect the current calendar, then classifies every
  // occurrence up to today. "Pending" lists are capped-length samples for the UI, with a total
  // count alongside so the panel can say "3 of 40 sessions still need closing out".
  async getOccurrenceCompletion(classId, resolveCalendar) {
    const occ = await SessionOccurrenceService.listForClassHydrated(classId, resolveCalendar);
    const today = todayStr();
    const past = occ.filter((o) => o.date <= today);

    const taughtPending = past.filter((o) => o.status === "scheduled");
    const attendancePending = past.filter((o) => o.attendanceState === "not_taken");

    const sample = (rows) =>
      rows.slice(0, 25).map((o) => ({
        id: o.id, sessionId: o.sessionId, courseId: o.courseId, date: o.date,
        sessionTitle: o.sessionTitle, sessionOrder: o.sessionOrder, courseName: o.courseName,
      }));

    return {
      sessionsTaught: {
        total: past.length,
        resolved: past.filter((o) => o.status === "taught" || o.status === "cancelled").length,
        taught: past.filter((o) => o.status === "taught").length,
        cancelled: past.filter((o) => o.status === "cancelled").length,
        pending: sample(taughtPending),
        pendingCount: taughtPending.length,
      },
      attendanceClosed: {
        total: past.length,
        resolved: past.filter((o) => o.attendanceState !== "not_taken").length,
        taken: past.filter((o) => o.attendanceState === "taken").length,
        lockedNotMarked: past.filter((o) => o.attendanceState === "locked_not_marked").length,
        pending: sample(attendancePending),
        pendingCount: attendancePending.length,
      },
      complete: taughtPending.length === 0 && attendancePending.length === 0 && past.length > 0,
    };
  },

  // --- Cleanup hooks (called from class.service.js / teacher.service.js) -------------------

  deleteAllForClass(classId) {
    return SessionOccurrenceModel.deleteByClassId(classId);
  },

  clearActor(teacherId) {
    return SessionOccurrenceModel.clearActor(teacherId);
  },
};

module.exports = SessionOccurrenceService;
