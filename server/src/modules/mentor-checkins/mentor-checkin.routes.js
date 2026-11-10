const express = require("express");
const ctl = require("./mentor-checkin.controller");

// Parent–mentor check-ins, mounted at /api/mentor-checkins with protect + attachOwnRecords (app.js).
// Who gets in: the workspace's admins and staff whose role grants "mentor-checkins"
// (access.registry.js); educators (teacher portal); parents (their own email login); the hub's own
// login; supervisors. What each sees is decided per record in mentor-checkin.access.js /
// mentor-checkin.service.js. Named routes come before "/:id" ones.
const router = express.Router();
router.use((req, res, next) => {
  const { role, hubLead, username } = req.user;
  if (role === "admin" || role === "teacher" || role === "supervisor" || (role === "school" && !hubLead) || (role === "learner" && !username)) return next();
  next(Object.assign(new Error("You do not have permission to perform this action"), { statusCode: 403 }));
});

// Templates (the same as QA's) — managers.
router.route("/templates").get(ctl.listTemplates).post(ctl.createTemplate);
router.route("/templates/:id").get(ctl.getTemplate).put(ctl.updateTemplate).delete(ctl.deleteTemplate);
router.put("/templates/:id/status", ctl.setTemplateStatus);

// Setting a round up (managers): hub → class → its educators and families → the draw → publish.
router.get("/hubs", ctl.hubs);
router.get("/hubs/:id/classes", ctl.hubClasses);
router.get("/classes/:id/people", ctl.classPeople);
router.post("/rounds/preview", ctl.preview);

// The sign-in pop-up (parents and educators).
router.get("/due", ctl.due);

router.route("/rounds").get(ctl.listRounds).post(ctl.createRound);
router.route("/rounds/:id").get(ctl.getRound).put(ctl.updateRound);
router.post("/rounds/:id/cancel", ctl.cancelRound);

router.get("/meetings", ctl.listMeetings);
router.get("/meetings/:id", ctl.getMeeting);
router.get("/meetings/:id/free-times", ctl.freeTimes);
router.put("/meetings/:id/time", ctl.changeTime);
router.post("/meetings/:id/confirm", ctl.confirm);
router.post("/meetings/:id/cancel", ctl.cancelMeeting);
router.post("/meetings/:id/missed", ctl.setMissed);
router.put("/meetings/:id/report", ctl.saveReport);
router.post("/meetings/:id/approve", ctl.approve);

module.exports = router;
