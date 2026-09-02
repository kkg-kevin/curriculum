const express = require("express");
const {
  getPathways,
  createPathway,
  updatePathway,
  deletePathway,
} = require("./pathway-template.controller");

const router = express.Router();

router.route("/").get(getPathways).post(createPathway);
router.route("/:aId").put(updatePathway).delete(deletePathway);

module.exports = router;
