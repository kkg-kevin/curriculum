const express = require("express");
const { authorize } = require("../../shared/middleware/auth.middleware");
const ctl = require("./checkin.controller");

// Hub check-ins, mounted at /api/checkins with protect + attachOwnRecords (app.js). The workspace
// owner, and staff whose role grants it (access.registry.js: "checkins" to take part,
// "checkins-manage" for schedules, cancelling, reopening and the overview) — staff reach
// authorize("admin") only once scope.middleware.js has checked their role. Which hubs and records
// each person sees is decided per record in checkin.service.js / checkin.access.js.
// Named routes come before "/:id" ones.
const router = express.Router();
router.use(authorize("admin"));

router.get("/people", ctl.people);
router.get("/hubs", ctl.hubs);
router.get("/overview", ctl.overview);

router.route("/schedules").get(ctl.listSchedules).post(ctl.createSchedule);
router.put("/schedules/:id", ctl.updateSchedule);
router.post("/schedules/:id/end", ctl.endSchedule);

router.get("/sessions", ctl.listSessions);
router.get("/sessions/:id", ctl.getSession);
router.put("/sessions/:id/report", ctl.saveReport);
router.post("/sessions/:id/submit", ctl.submitReport);
router.post("/sessions/:id/reopen", ctl.reopenReport);
router.post("/sessions/:id/reschedule", ctl.rescheduleSession);
router.post("/sessions/:id/cancel", ctl.cancelSession);
router.post("/sessions/:id/actions", ctl.createAction);

router.get("/actions", ctl.listActions);
router.route("/actions/:id").get(ctl.getAction).put(ctl.updateAction).delete(ctl.deleteAction);
router.post("/actions/:id/status", ctl.setActionStatus);
router.post("/actions/:id/notes", ctl.addActionNote);
router.post("/actions/:id/escalate", ctl.escalateAction);

module.exports = router;
