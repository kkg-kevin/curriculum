const express = require("express");
const {
  getPublicBootcamps,
  getPublicBootcamp,
  getPublicProjects,
  getPublicProject,
  getPublicPathways,
  getPublicPathway,
} = require("./public-site.controller");

// Unauthenticated by design — digifunzi-landing's Bootcamps/Projects/Pathways pages
// (spec §4.1/§4.2 and the Learning Pathways section). Mounted at /api/public, same shape
// as public-lead.routes.js.
const router = express.Router();

router.get("/bootcamps", getPublicBootcamps);
router.get("/bootcamps/:idOrSlug", getPublicBootcamp);
router.get("/projects", getPublicProjects);
router.get("/projects/:idOrSlug", getPublicProject);
router.get("/pathways", getPublicPathways);
router.get("/pathways/:idOrSlug", getPublicPathway);

module.exports = router;
