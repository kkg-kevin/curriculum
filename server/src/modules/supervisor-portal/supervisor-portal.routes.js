const express = require("express");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { authorize } = require("../../shared/middleware/auth.middleware");
const S = require("./supervisor-portal.service");

// The supervisor portal's own endpoints (17 Nov 2026), mounted at /api/supervisor-portal with
// protect + attachOwnRecords (app.js). Supervisors only; everything is limited to their own
// educators (supervisor-portal.service.js).
//   GET  /me              their own account, who manages it, their work in figures (My Profile)
//   GET  /educators/:id   an educator's details (contact, schools, availability, qualifications, classes)
//   GET  /activity        what their educators did (?educator=&view=&from=&to=&page=)
//   POST /messages        { teacherIds?, title?, message } — a note to some or all of them
const router = express.Router();
router.use(authorize("supervisor"));

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const messageSchema = z.object({
  teacherIds: z.array(z.string().max(64)).max(200).optional(),
  title: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().min(1, "Write the message").max(2000, "Keep it under 2000 characters"),
});

router.get("/me", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await S.me(req) });
}));

router.get("/educators/:id", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await S.educator(req, req.params.id) });
}));

router.get("/activity", asyncHandler(async (req, res) => {
  const q = req.query;
  const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  res.json({ success: true, data: await S.activity(req, {
    teacherId: text(q.educator),
    view: text(q.view),
    from: DAY.test(q.from || "") ? new Date(`${q.from}T00:00:00`) : undefined,
    to: DAY.test(q.to || "") ? new Date(`${q.to}T23:59:59.999`) : undefined,
    page: Number(q.page) || 1,
  }) });
}));

router.post("/messages", asyncHandler(async (req, res) => {
  const parsed = messageSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Check the message" });
  res.status(201).json({ success: true, data: await S.message(req, parsed.data) });
}));

module.exports = router;
