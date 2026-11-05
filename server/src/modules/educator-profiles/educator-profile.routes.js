const express = require("express");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { authorize } = require("../../shared/middleware/auth.middleware");
const EducatorProfileService = require("./educator-profile.service");

// The educator performance profile (educator-profile.service.js), mounted at /api/educator-profiles
// with protect + attachOwnRecords (app.js); staff reach it through Educators (access.registry.js).
const router = express.Router();
const fresh = (req) => req.query.fresh === "1";

// The educator's own profile, and their About + whether to share it.
router.get("/me", authorize("teacher"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await EducatorProfileService.mine(req, { fresh: fresh(req) }) });
}));
const aboutSchema = z.object({
  headline: z.string().max(400).optional().default(""),
  bio: z.string().max(5000).optional().default(""),
  specialties: z.array(z.string().max(80)).max(20).optional().default([]),
  languages: z.array(z.string().max(60)).max(12).optional().default([]),
  ageRange: z.string().max(60).optional().default(""),
});
router.put("/me", authorize("teacher"), asyncHandler(async (req, res) => {
  const body = z.object({ about: aboutSchema, optIn: z.boolean() }).parse(req.body);
  res.json({ success: true, data: await EducatorProfileService.saveMine(req, body) });
}));

// Find a mentor (parent portal), and asking for one.
router.get("/directory", authorize("learner"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await EducatorProfileService.directory(req) });
}));
router.post("/:teacherId/requests", authorize("learner"), asyncHandler(async (req, res) => {
  const body = z.object({ learnerId: z.string().min(1).max(36), note: z.string().max(2000).optional().default("") }).parse(req.body);
  res.status(201).json({ success: true, data: await EducatorProfileService.requestMentor(req, req.params.teacherId, body) });
}));

// A family's request handled (admins, the supervisor).
router.patch("/requests/:id", authorize("admin", "supervisor"), asyncHandler(async (req, res) => {
  await EducatorProfileService.handleRequest(req, req.params.id);
  res.json({ success: true });
}));

// The internal profile — admins / staff, the supervisor, the hub (less), the educator (theirs).
router.get("/:teacherId", authorize("admin", "supervisor", "school", "teacher"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await EducatorProfileService.profile(req, req.params.teacherId, { fresh: fresh(req) }) });
}));

// Publishing (admins): approve, send back with a note, or take down.
router.post("/:teacherId/review", authorize("admin"), asyncHandler(async (req, res) => {
  const body = z.object({ action: z.enum(["approve", "send_back", "unpublish"]), note: z.string().max(1000).optional().default("") }).parse(req.body);
  res.json({ success: true, data: await EducatorProfileService.review(req, req.params.teacherId, body) });
}));

// The public profile (no sign-in) — the portal's own share page reads it; only published profiles.
const publicRouter = express.Router();
publicRouter.get("/educators/:slug", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await EducatorProfileService.publicProfile(req.params.slug) });
}));

module.exports = { router, publicRouter };
