// Reports & Analytics (admin Reports page and the hub portal's): logins, time to task,
// assessments, competencies and learners at risk, for the period and filters in the query —
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&hubId&curriculumId&classId&courseId&stageId&pathway&gender.
// Admins (and staff with Reports access, via /api/analytics in access.registry.js) see their
// workspace's hubs; a hub login only the hub it is acting as (analytics.scope.js).

const express = require("express");
const { authorize } = require("../../shared/middleware/auth.middleware");
const asyncHandler = require("express-async-handler");
const { resolveScope } = require("./analytics.scope");
const { getFilters } = require("./analytics.filters");
const { getLogins } = require("./analytics.logins");
const { getTimeToTask } = require("./analytics.time");
const { getAssessments } = require("./analytics.assessments");
const { getCompetencies } = require("./analytics.competencies");
const { getAtRisk } = require("./analytics.risk");
const { getParentFeedback } = require("./analytics.feedback");
const { getEducators } = require("./analytics.educators");
const { getAttention } = require("./analytics.attention");
const { getTrends } = require("./analytics.trends");
const { getHubs } = require("./analytics.hubs");
const { getGrowth } = require("./analytics.growth");
const { getAttendance } = require("./analytics.attendance");
const { getEnrolment } = require("./analytics.enrolment");
const { getParents } = require("./analytics.parents");
const Followups = require("./analytics.followups");
const { z } = require("zod");

const router = express.Router();
router.use(authorize("admin", "school"));

const VIEWS = {
  logins: getLogins,
  "time-to-task": getTimeToTask,
  assessments: getAssessments,
  competencies: getCompetencies,
  "at-risk": getAtRisk,
  "parent-feedback": getParentFeedback,
  educators: getEducators,
  // 10 Nov 2026: what needs doing, the year's trend, hubs side by side, learner growth,
  // attendance, enrolment & income (admins), parent engagement.
  attention: getAttention,
  trends: getTrends,
  hubs: getHubs,
  growth: getGrowth,
  attendance: getAttendance,
  enrolment: getEnrolment,
  parents: getParents,
};

// Following up a learner at risk (analytics.followups.js): message the parent, tell the class's
// educators, note a booked check-in, or mark them followed up.
const followupSchema = z.object({
  learnerId: z.string().min(1).max(64),
  action: z.enum(Followups.ACTIONS),
  note: z.string().max(2000).optional().default(""),
  message: z.string().max(2000).optional().default(""),
  reasons: z.array(z.string().max(60)).max(6).optional().default([]),
});

router.get("/filters", asyncHandler(async (req, res) => {
  // The choices depend only on which hub(s) — not on the other filters.
  const scope = await resolveScope({ ...req, query: { hubId: req.query.hubId }, user: req.user, ownSchool: req.ownSchool, ownerAdminId: req.ownerAdminId });
  res.json({ success: true, data: await getFilters(scope) });
}));

router.post("/followups", asyncHandler(async (req, res) => {
  const parsed = followupSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ success: false, message: "Check the follow-up", errors: parsed.error.issues });
  const scope = await resolveScope({ ...req, query: {} });
  res.status(201).json({ success: true, data: await Followups.record(scope, req.user, parsed.data) });
}));

router.get("/followups/:learnerId", asyncHandler(async (req, res) => {
  const scope = await resolveScope({ ...req, query: {} });
  if (!scope.learnerIds.has(req.params.learnerId)) return res.status(403).json({ success: false, message: "That learner isn't in your hubs" });
  res.json({ success: true, data: await Followups.history(req.params.learnerId) });
}));

router.get("/:view", asyncHandler(async (req, res) => {
  const fn = VIEWS[req.params.view];
  if (!fn) return res.status(404).json({ success: false, message: "Unknown analytics view" });
  const scope = await resolveScope(req);
  res.json({ success: true, data: await fn(scope) });
}));

module.exports = router;
