const express = require("express");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { authorize } = require("../../shared/middleware/auth.middleware");
const LearnerMoveService = require("./learner-move.service");
const { PROGRAMMES } = require("./learner-move.rules");

// Moving a learner between programmes (learner-move.service.js). Admins, and staff with
// Learners → Edit (access.registry.js) — plus Create on the programme they move someone into,
// checked in the service.
//
//   GET  /api/learner-moves/:learnerId           what they hold, what stays theirs, where they can go
//   POST /api/learner-moves/:learnerId/move      { destination: { programme, … }, endKeys, stopKeys }
//   GET  /api/learner-moves/:learnerId/history   their Moves, newest first

const router = express.Router();
const admin = authorize("admin");

const id = z.string().trim().max(64);
const optionalId = id.optional().nullable().or(z.literal(""));
const moveSchema = z.object({
  destination: z.object({
    programme: z.enum(PROGRAMMES),
    hubId: optionalId,
    classId: optionalId,
    bootcampId: optionalId,
    invoice: z.boolean().optional(),
    householdId: optionalId,
    household: z.record(z.string(), z.any()).optional(),
    enrollment: z.object({ curriculumId: optionalId, gradeId: optionalId, educatorId: optionalId }).partial().optional(),
    membershipId: optionalId,
    membership: z.record(z.string(), z.any()).optional(),
    packageId: optionalId,
    subscriptionId: optionalId,
    curriculumId: optionalId,
    pathwayRowId: optionalId,
    billingPeriod: z.string().max(20).optional().nullable().or(z.literal("")),
    startDate: z.string().max(10).optional().nullable().or(z.literal("")),
    guardianName: z.string().max(150).optional().nullable(),
    guardianEmail: z.string().max(255).optional().nullable(),
    guardianPhone: z.string().max(30).optional().nullable(),
  }),
  endKeys: z.array(z.string().max(120)).max(50).optional(),
  stopKeys: z.array(z.string().max(120)).max(50).optional(),
});

// Empty strings from the form mean "not chosen".
const tidy = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v]));

router.get("/:learnerId", admin, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await LearnerMoveService.options(req, req.params.learnerId) });
}));

router.get("/:learnerId/history", admin, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await LearnerMoveService.history(req, req.params.learnerId) });
}));

router.post("/:learnerId/move", admin, asyncHandler(async (req, res) => {
  const parsed = moveSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Check the move's details" });
  const body = { ...parsed.data, destination: tidy(parsed.data.destination) };
  res.status(201).json({ success: true, data: await LearnerMoveService.move(req, req.params.learnerId, body) });
}));

module.exports = router;
