const express = require("express");
const { createRoom, getAllRooms, getRoomById, updateRoom, deleteRoom, getRoomAvailability } = require("./room.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Only school/branchAdmin/admin ever author timetable slots (see timetable.routes.js), so only
// they need to manage or pick from a hub's rooms — no teacher/learner read access here.
// Literal path — must be registered ahead of "/:id" below, otherwise Express would match
// "availability" as the :id param and this route would never be reached.
router.route("/availability").get(authorize("admin", "school", "branchAdmin"), getRoomAvailability);
router.route("/")
  .get(authorize("admin", "school", "branchAdmin"), getAllRooms)
  .post(authorize("admin", "school", "branchAdmin"), createRoom);
router.route("/:id")
  .get(authorize("admin", "school", "branchAdmin"), getRoomById)
  .put(authorize("admin", "school", "branchAdmin"), updateRoom)
  .delete(authorize("admin", "school", "branchAdmin"), deleteRoom);

module.exports = router;
