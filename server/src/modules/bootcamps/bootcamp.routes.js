const express = require("express");
const {
  createBootcamp,
  getAllBootcamps,
  getBootcampById,
  updateBootcamp,
  deleteBootcamp,
} = require("./bootcamp.controller");

const router = express.Router();

// Admin-only — gated at the app.js mount, same as events / competencies / inventory.
router.route("/").get(getAllBootcamps).post(createBootcamp);
router.route("/:id").get(getBootcampById).put(updateBootcamp).delete(deleteBootcamp);

module.exports = router;
