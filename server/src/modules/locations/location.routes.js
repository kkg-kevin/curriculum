const express = require("express");
const {
  createLocation,
  getAllLocations,
  getLocationById,
  updateLocation,
  deleteLocation,
} = require("./location.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// A "school"-type location only ever sees its own record (getAllLocations/getLocationById force
// that server-side); "teacher"/"learner" only need to read their own school's profile (e.g. to
// show its name on their dashboard) — never the full directory, so only the by-id route allows
// them. Non-school location types (campus/branch/classroom/etc.) have no portal login yet, so
// this same admin+school role table simply doesn't apply to them in practice.
router.route("/")
  .get(authorize("admin", "school"), getAllLocations)
  .post(authorize("admin"), createLocation);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getLocationById)
  .put(authorize("admin", "school"), updateLocation)
  .delete(authorize("admin"), deleteLocation);

module.exports = router;
