const express = require("express");
const { createRoom, getAllRooms, getRoomById, updateRoom, deleteRoom } = require("./room.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Only school/branchAdmin/admin ever author timetable slots (see timetable.routes.js), so only
// they need to manage or pick from a hub's rooms — no teacher/learner read access here.
router.route("/")
  .get(authorize("admin", "school", "branchAdmin"), getAllRooms)
  .post(authorize("admin", "school", "branchAdmin"), createRoom);
router.route("/:id")
  .get(authorize("admin", "school", "branchAdmin"), getRoomById)
  .put(authorize("admin", "school", "branchAdmin"), updateRoom)
  .delete(authorize("admin", "school", "branchAdmin"), deleteRoom);

module.exports = router;
