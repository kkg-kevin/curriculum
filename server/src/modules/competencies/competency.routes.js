const express = require("express");
const {
  getCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  getIndicators,
  createIndicator,
  updateIndicator,
  deleteIndicator,
} = require("./competency.controller");

const router = express.Router();

router.route("/").get(getCompetencies).post(createCompetency);
router.route("/:cId").put(updateCompetency).delete(deleteCompetency);

router.route("/:cId/indicators").get(getIndicators).post(createIndicator);
router.route("/:cId/indicators/:iId").put(updateIndicator).delete(deleteIndicator);

module.exports = router;
