const express = require("express");
const {
  getPathways,
  getDirectory,
  setWebsite,
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
// (The one-off pathway price — PUT /:aId/pricing — was removed 4 Nov 2026: pathways are sold by
// subscription plans, Billing → Packages → Pathway plans, modules/pathway-subscriptions/.)

module.exports = router;
