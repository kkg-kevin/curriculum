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
};

router.get("/filters", asyncHandler(async (req, res) => {
  // The choices depend only on which hub(s) — not on the other filters.
  const scope = await resolveScope({ ...req, query: { hubId: req.query.hubId }, user: req.user, ownSchool: req.ownSchool, ownerAdminId: req.ownerAdminId });
  res.json({ success: true, data: await getFilters(scope) });
}));

router.get("/:view", asyncHandler(async (req, res) => {
  const fn = VIEWS[req.params.view];
  if (!fn) return res.status(404).json({ success: false, message: "Unknown analytics view" });
  const scope = await resolveScope(req);
  res.json({ success: true, data: await fn(scope) });
}));

module.exports = router;
