const express = require("express");
const {
  getCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
} = require("./competency.controller");

const router = express.Router();

router.route("/").get(getCompetencies).post(createCompetency);
router.route("/:cId").put(updateCompetency).delete(deleteCompetency);

module.exports = router;
