const express = require("express");
const ctl = require("./mentor-booking.controller");

// Mentor bookings, mounted at /api/mentor-bookings with protect + attachOwnRecords (app.js).
// Who gets in: the workspace's admins and staff whose role grants "mentor-bookings"
// (access.registry.js); mentors (teacher portal); parents (their own email login) and children
// (their username login — help requests only); the hub's own login (its bookings and statement).
// What each sees is decided per record in mentor-booking.service.js. Named routes before "/:id".
const router = express.Router();
router.use((req, res, next) => {
  const { role, hubLead } = req.user;
  if (role === "admin" || role === "teacher" || (role === "school" && !hubLead) || role === "learner") return next();
  next(Object.assign(new Error("You do not have permission to perform this action"), { statusCode: 403 }));
});

// Settings → Educator Pay → Mentor bookings.
router.route("/settings").get(ctl.getSettings).put(ctl.updateSettings);

// Booking (parents): what can be booked, free times, book.
router.get("/options", ctl.options);
router.get("/free-times", ctl.freeTimes);

// Help requests (children ask; parents read them and book from them).
router.route("/help").get(ctl.listHelp).post(ctl.askForHelp);
router.post("/help/:id/close", ctl.closeHelp);

// Partner hubs: what each is owed, its statement, settling it.
router.get("/hubs", ctl.hubsOwed);
router.get("/hubs/:hubId/statement", ctl.statement);
router.post("/hubs/:hubId/settle", ctl.settle);

router.route("/").get(ctl.list).post(ctl.book);
router.get("/:id", ctl.get);
router.post("/:id/cancel", ctl.cancel);
router.post("/:id/mark", ctl.mark);
router.put("/:id/link", ctl.setLink);
router.post("/:id/refunded", ctl.markRefunded);

module.exports = router;
