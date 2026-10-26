const express = require("express");
const ctl = require("./checkin.controller");

// Hub check-ins, mounted at /api/checkins with protect + attachOwnRecords (app.js). Who gets in:
//   - the workspace's admins, and staff whose role grants "checkins-manage" (access.registry.js —
//     staff reach role "admin" only once scope.middleware.js has checked their role);
//   - a hub's Account Manager / Training Lead in the hub portal (a "school" session with
//     req.user.hubLead — see account-roles.js);
//   - an educator's own session, for GET /due only (the teacher portal's pop-up).
// Which hubs and check-ins each person sees is decided per record in checkin.service.js /
// checkin.access.js; schedules are managers' only. Named routes come before "/:id" ones.
const router = express.Router();
router.use((req, res, next) => {
  const { role, hubLead } = req.user;
  const dueOnly = req.method === "GET" && req.path === "/due";
  if (role === "admin" || (role === "school" && hubLead) || (role === "teacher" && dueOnly)) return next();
  next(Object.assign(new Error("You do not have permission to perform this action"), { statusCode: 403 }));
});

router.get("/people", ctl.people);
router.get("/hubs", ctl.hubs);
// The sign-in pop-up: my check-ins due (today or earlier) with no report yet.
router.get("/due", ctl.due);

router.route("/schedules").get(ctl.listSchedules).post(ctl.createSchedule);
router.put("/schedules/:id", ctl.updateSchedule);
router.post("/schedules/:id/end", ctl.endSchedule);

router.get("/sessions", ctl.listSessions);
router.get("/sessions/:id", ctl.getSession);
router.put("/sessions/:id/report", ctl.saveReport);

module.exports = router;
