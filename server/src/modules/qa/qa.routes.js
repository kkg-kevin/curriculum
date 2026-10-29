const express = require("express");
const ctl = require("./qa.controller");

// Quality assurance, mounted at /api/qa with protect + attachOwnRecords (app.js). Who gets in:
//   - the workspace's admins, and staff whose role grants "qa" (access.registry.js);
//   - supervisors — for the educators assigned to them;
//   - an educator's own session: reading their visits, and replying to a report;
//   - the hub's own login (the hub portal): reading its visits, a summary of each report.
// Which visits each sees, and what of them, is decided per record in qa.service.js / qa.access.js.
// Named routes come before "/:id" ones.
const router = express.Router();
router.use((req, res, next) => {
  const { role } = req.user;
  const reading = req.method === "GET" && /^\/visits(\/[^/]+)?$/.test(req.path);
  const replying = req.method === "PUT" && /^\/visits\/[^/]+\/reply$/.test(req.path);
  if (role === "admin" || role === "supervisor" || (role === "teacher" && (reading || replying)) || (role === "school" && reading)) return next();
  next(Object.assign(new Error("You do not have permission to perform this action"), { statusCode: 403 }));
});

router.route("/templates").get(ctl.listTemplates).post(ctl.createTemplate);
router.route("/templates/:id").get(ctl.getTemplate).put(ctl.updateTemplate).delete(ctl.deleteTemplate);
router.put("/templates/:id/status", ctl.setTemplateStatus);

router.get("/educators", ctl.educators);
router.get("/reviewers", ctl.reviewers);

router.route("/schedules").get(ctl.listSchedules).post(ctl.createSchedule);
router.put("/schedules/:id", ctl.updateSchedule);
router.post("/schedules/:id/end", ctl.endSchedule);

router.route("/visits").get(ctl.listVisits).post(ctl.createVisit);
router.route("/visits/:id").get(ctl.getVisit).put(ctl.updateVisit);
router.post("/visits/:id/cancel", ctl.cancelVisit);
router.put("/visits/:id/review", ctl.saveReview);
router.put("/visits/:id/reply", ctl.saveReply);

module.exports = router;
