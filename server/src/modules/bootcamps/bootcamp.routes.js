const express = require("express");
const {
  createBootcamp,
  getAllBootcamps,
  getBootcampById,
  updateBootcamp,
  deleteBootcamp,
  listOfferings,
  createOffering,
  deleteOffering,
} = require("./bootcamp.controller");

const router = express.Router();

// Admin-only — gated at the app.js mount, same as competitions / competencies / inventory.
router.route("/").get(getAllBootcamps).post(createBootcamp);
router.route("/:id").get(getBootcampById).put(updateBootcamp).delete(deleteBootcamp);
// Hub-offerings — "run this bootcamp at a hub", replacing the old standalone Event-deployment
// flow. Nested under the parent since an offering has no identity outside its bootcamp.
router.route("/:id/hubs").get(listOfferings).post(createOffering);
router.route("/:id/hubs/:offeringId").delete(deleteOffering);

module.exports = router;
