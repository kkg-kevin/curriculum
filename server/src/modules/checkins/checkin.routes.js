const express = require("express");
const ctl = require("./checkin.controller");

// Hub check-ins, mounted at /api/checkins with protect + attachOwnRecords (app.js). Who gets in:
//   - the workspace's admins, and staff whose role grants "checkins-manage" (access.registry.js —
//     staff reach role "admin" only once scope.middleware.js has checked their role);
//   - a hub's Account Manager / Training Lead in the hub portal (a "school" session with
//     req.user.hubLead — see account-roles.js);
//   - an educator's own session, for GET /due only (the teacher portal's pop-up);
//   - the hub's own login (the hub portal), reading its own check-ins and reports only.
// Which hubs and check-ins each person sees is decided per record in checkin.service.js /
// checkin.access.js; schedules are managers' only. Named routes come before "/:id" ones.
const router = express.Router();
router.use((req, res, next) => {
  const { role, hubLead } = req.user;
  const dueOnly = req.method === "GET" && req.path === "/due";
  const readingSessions = req.method === "GET" && /^\/sessions(\/[^/]+)?$/.test(req.path);
  // Educators and parents: the check-ins they take part in, and the pop-up (6 Nov 2026).
  const taking = (role === "teacher" || role === "learner") && (dueOnly || readingSessions);
  if (role === "admin" || (role === "school" && (hubLead || readingSessions)) || taking) return next();
  next(Object.assign(new Error("You do not have permission to perform this action"), { statusCode: 403 }));
});

router.get("/people", ctl.people);

// Templates (the same as QA's) — managers only, checked in checkin.service.js.
router.route("/templates").get(ctl.listTemplates).post(ctl.createTemplate);
router.route("/templates/:id").get(ctl.getTemplate).put(ctl.updateTemplate).delete(ctl.deleteTemplate);
router.put("/templates/:id/status", ctl.setTemplateStatus);
router.get("/hubs", ctl.hubs);
// Who can take part in a hub's check-ins: our team, the hub's login, its mentors, its parents.
router.get("/hubs/:id/people", ctl.hubPeople);
// The sign-in pop-up: my check-ins due (today or earlier) with no report yet.
router.get("/due", ctl.due);

router.route("/schedules").get(ctl.listSchedules).post(ctl.createSchedule);
router.put("/schedules/:id", ctl.updateSchedule);
router.post("/schedules/:id/end", ctl.endSchedule);

router.get("/sessions", ctl.listSessions);
router.get("/sessions/:id", ctl.getSession);
router.put("/sessions/:id/report", ctl.saveReport);

// Tasks from a check-in's resolutions.
router.get("/tasks", ctl.listTasks);
router.post("/sessions/:id/tasks", ctl.createTask);
router.put("/tasks/:id", ctl.updateTask);
router.put("/tasks/:id/status", ctl.setTaskStatus);
router.delete("/tasks/:id", ctl.deleteTask);

module.exports = router;
