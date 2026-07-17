const express = require("express");
const { markAttendance, getByClassDate, getHistory } = require("./attendance.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Ownership (a teacher can only touch their own class, a school only its own) is enforced in
// the controller via the class the attendance belongs to — same pattern as classes/learners.
router.post("/mark", authorize("admin", "school", "teacher"), markAttendance);
router.get("/", authorize("admin", "school", "teacher"), getByClassDate);
router.get("/history", authorize("admin", "school", "teacher"), getHistory);

module.exports = router;
