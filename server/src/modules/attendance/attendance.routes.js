const express = require("express");
const { markAttendance, getByClassDate, getHistory } = require("./attendance.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Ownership (a teacher can only touch their own class, a school/branchAdmin only hub(s) they
// own) is enforced in the controller via the class the attendance belongs to — same pattern as
// classes/learners.
router.post("/mark", authorize("admin", "school", "teacher", "branchAdmin"), markAttendance);
router.get("/", authorize("admin", "school", "teacher", "branchAdmin"), getByClassDate);
// Also learner-facing (own record only, forced server-side — see getHistory in the controller)
// — the learner-portal dashboard's own attendance-rate pill reads this. getByClassDate above
// stays admin/school/teacher/branchAdmin-only since it returns the WHOLE class's records for one
// date, not scoped to a single learner the way history's learnerId filter is.
router.get("/history", authorize("admin", "school", "teacher", "branchAdmin", "learner"), getHistory);

module.exports = router;
