const express = require("express");
const {
  getPublicBootcamps,
  getPublicBootcamp,
  getPublicProjects,
  getPublicProject,
} = require("./public-site.controller");

// Unauthenticated by design — digifunzi-landing's Bootcamps/Projects pages (spec §4.1/§4.2).
// Mounted at /api/public, same shape as public-lead.routes.js.
const router = express.Router();

router.get("/bootcamps", getPublicBootcamps);
router.get("/bootcamps/:idOrSlug", getPublicBootcamp);
router.get("/projects", getPublicProjects);
router.get("/projects/:idOrSlug", getPublicProject);

module.exports = router;
