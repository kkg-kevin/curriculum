const express = require("express");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const db = require("../../config/db");
const TotService = require("./tot.service");
const { workspaceTeacherIds } = require("../qa/qa.access");
const { authorize } = require("../../shared/middleware/auth.middleware");

// Training of trainers (modules/tot/tot.service.js), mounted at /api/tot with protect +
// attachOwnRecords (app.js). Who reaches what:
//   admin       (and staff with Educators) the TOT classes, enrolling an educator, every
//               educator's training, and the marking queue of educators with no supervisor.
//   supervisor  their own educators' training and work to mark.
//   school      (the hub) its own educators' training — their TOT classes at that hub only.
const router = express.Router();
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const supervisorOf = (req) => (req.user.role === "supervisor" ? req.user.id : null);
const ownerOf = (req) => (req.user.role === "supervisor" ? req.user.invitedByAdminId : req.ownerAdminId);

async function teacherFor(req, teacherId) {
  const teacher = await db("teachers").where({ id: teacherId }).first();
  if (!teacher) fail("Educator not found", 404);
  if (req.user.role === "supervisor") {
    if (teacher.supervisorId !== req.user.id) fail("Educator not found", 404);
  } else if (req.user.role === "school") {
    const linked = await db("teacher_hub_links").where({ teacherId, hubId: req.ownSchool?.id || "__none__" }).first();
    if (!linked) fail("Educator not found", 404);
  } else if (!(await workspaceTeacherIds(req.ownerAdminId)).includes(teacherId)) {
    fail("Educator not found", 404);
  }
  return teacher;
}

// The educator's own training (the teacher portal: whether "My learning" shows, and its summary).
router.get("/me", authorize("teacher"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.ownTeacher ? await TotService.progressFor(req.ownTeacher.id) : null });
}));

router.get("/classes", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await TotService.totClasses(req.ownerAdminId) });
}));

const enrolSchema = z.object({ hubId: z.string().min(1, "Choose the hub").max(36), classId: z.string().min(1, "Choose the class").max(36) });
router.post("/educators/:teacherId/enrol", authorize("admin"), asyncHandler(async (req, res) => {
  const teacher = await teacherFor(req, req.params.teacherId);
  const data = enrolSchema.parse(req.body);
  res.status(201).json({ success: true, data: await TotService.enrol(teacher, data, { ownerAdminId: req.ownerAdminId }) });
}));

router.get("/educators/:teacherId", authorize("admin", "supervisor", "school"), asyncHandler(async (req, res) => {
  await teacherFor(req, req.params.teacherId);
  const hubIds = req.user.role === "school" ? [req.ownSchool?.id].filter(Boolean) : null;
  res.json({ success: true, data: await TotService.progressFor(req.params.teacherId, { hubIds }) });
}));

// Work waiting to be marked. An admin sees their educators with no supervisor (?all=1: every one).
router.get("/marking", authorize("admin", "supervisor"), asyncHandler(async (req, res) => {
  const rows = await TotService.markingQueue({ supervisorId: supervisorOf(req), ownerAdminId: ownerOf(req), all: req.query.all === "1" });
  res.json({ success: true, data: rows });
}));

module.exports = router;
