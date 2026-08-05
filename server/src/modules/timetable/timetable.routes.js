const express = require("express");
const {
  createSlot, listByClass, updateSlot, deleteSlot,
  getMyTeacherTimetable, getMyLearnerTimetable,
  listCourseSchedules, setCourseSchedule,
  getClassCalendar, getMyTeacherCalendar, getMyLearnerCalendar,
  getSessionSummary, getSessionStatusBulk,
} = require("./timetable.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Every static-path route below MUST be registered before the "/:id" routes further down —
// Express matches in registration order, so "/:id" would otherwise swallow e.g. PUT
// "/course-schedule" as if "course-schedule" were an :id (it did, until this ordering fix).

// Course start-date anchors — same authoring/read posture as slots below.
router.get("/course-schedule", authorize("admin", "school", "branchAdmin", "teacher"), listCourseSchedules);
router.put("/course-schedule", authorize("admin", "school", "branchAdmin"), setCourseSchedule);

// Resolved calendar (real dates, Sessions placed onto them) — read-only, same role split as
// their slot-list equivalents below.
router.get("/calendar", authorize("admin", "school", "branchAdmin", "teacher"), getClassCalendar);
router.get("/teacher/mine/calendar", authorize("teacher"), getMyTeacherCalendar);
router.get("/learner/mine/calendar", authorize("learner"), getMyLearnerCalendar);

// Click/hover-through detail for one calendar event — attendance + grading progress for that
// session. Teacher and hub level only (not learner) — it surfaces every enrolled learner's
// attendance and scores, not just the viewer's own.
router.get("/sessions/:sessionId/summary", authorize("admin", "school", "branchAdmin", "teacher"), getSessionSummary);
router.post("/sessions/status", authorize("admin", "school", "branchAdmin", "teacher"), getSessionStatusBulk);

// Teacher/learner-facing: their own timetable, resolved from their own linked classes.
router.get("/teacher/mine", authorize("teacher"), getMyTeacherTimetable);
router.get("/learner/mine", authorize("learner"), getMyLearnerTimetable);

// Authoring (create/update/delete) is admin/school/branchAdmin only — a school builds its own
// timetable, same posture as class/attendance authorship. Teachers read their own class's
// timetable here too (listByClass), same as attendance's getByClassDate.
router.post("/", authorize("admin", "school", "branchAdmin"), createSlot);
router.get("/", authorize("admin", "school", "branchAdmin", "teacher"), listByClass);
router.put("/:id", authorize("admin", "school", "branchAdmin"), updateSlot);
router.delete("/:id", authorize("admin", "school", "branchAdmin"), deleteSlot);

module.exports = router;
