const express = require("express");
const { getPublicPathways, getPublicPathway } = require("./public-site.controller");

// Unauthenticated by design — digifunzi-landing's Pathways pages (see the Learning Pathways
// section of the integration contract). Mounted at /api/public, same shape as
// public-lead.routes.js. Bootcamps/Projects were removed here — see Guide/DEPLOYMENT.md.
const router = express.Router();

router.get("/pathways", getPublicPathways);
router.get("/pathways/:idOrSlug", getPublicPathway);

module.exports = router;
