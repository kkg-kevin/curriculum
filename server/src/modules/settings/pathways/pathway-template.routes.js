const express = require("express");
const {
  getPathways,
  getDirectory,
  setWebsite,
  setPricing,
  createPathway,
  updatePathway,
  deletePathway,
} = require("./pathway-template.controller");

const router = express.Router();

router.route("/").get(getPathways).post(createPathway);
// Before "/:aId" — Settings → Pathways' read-only directory.
router.get("/directory", getDirectory);
router.route("/:aId").put(updatePathway).delete(deletePathway);
router.put("/:aId/website", setWebsite);
router.put("/:aId/pricing", setPricing);

module.exports = router;
