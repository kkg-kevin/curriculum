const express = require("express");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { authorize } = require("../../shared/middleware/auth.middleware");
const MentorReviewService = require("./mentor-review.service");

// Parent feedback on mentors (mentor-review.service.js), mounted at /api/mentor-reviews with
// protect + attachOwnRecords (app.js); staff reach it through Educators (access.registry.js).
const router = express.Router();

// A parent's children (or a TOT learner's own place) with their mentors, and saving a review.
router.get("/mine", authorize("learner"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MentorReviewService.listMine(req) });
}));

const reviewSchema = z.object({
  learnerId: z.string().min(1).max(36),
  teacherId: z.string().min(1).max(36),
  courseId: z.string().min(1).max(36),
  overall: z.number().int(),
  ratings: z.record(z.string(), z.number().int().nullable()).optional().default({}),
  comment: z.string().max(4000).optional().default(""),
  concern: z.boolean().optional().default(false),
  concernText: z.string().max(4000).optional().default(""),
  websiteConsent: z.boolean().optional().default(false),
});
router.put("/mine", authorize("learner"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MentorReviewService.submit(req, reviewSchema.parse(req.body)) });
}));

// The signed-in educator's own feedback (anonymous summary, from 3 reviews).
router.get("/me", authorize("teacher"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MentorReviewService.mine(req) });
}));

// An educator's feedback: named for admins / staff / their supervisor, averages for a hub.
router.get("/educators/:teacherId", authorize("admin", "supervisor", "school"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MentorReviewService.feedbackForEducator(req, req.params.teacherId) });
}));

// Moderation: hide / show a comment, feature it on the website (admins), resolve a concern.
router.patch("/:id/hidden", authorize("admin", "supervisor"), asyncHandler(async (req, res) => {
  await MentorReviewService.setHidden(req, req.params.id, z.object({ hidden: z.boolean() }).parse(req.body).hidden);
  res.json({ success: true });
}));
router.patch("/:id/featured", authorize("admin"), asyncHandler(async (req, res) => {
  await MentorReviewService.setFeatured(req, req.params.id, z.object({ featured: z.boolean() }).parse(req.body).featured);
  res.json({ success: true });
}));
router.patch("/:id/concern-resolved", authorize("admin", "supervisor"), asyncHandler(async (req, res) => {
  await MentorReviewService.resolveConcern(req, req.params.id);
  res.json({ success: true });
}));

// Settings → Parent feedback.
router.get("/settings", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MentorReviewService.getSettings(req.ownerAdminId) });
}));
router.put("/settings", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MentorReviewService.saveSettings(req.ownerAdminId, req.body || {}) });
}));

// The website's testimonials (no sign-in): featured comments the parent agreed to share.
const publicRouter = express.Router();
publicRouter.get("/testimonials", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MentorReviewService.publicTestimonials() });
}));

module.exports = { router, publicRouter };
