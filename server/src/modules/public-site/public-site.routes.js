const express = require("express");
const { getPublicPathways, getPublicPathway } = require("./public-site.controller");
const { getPublicProjects, getPublicProject } = require("./public-project.controller");

// Unauthenticated by design — digifunzi-landing's Pathways and Projects pages (see the
// integration contract). Mounted at /api/public, same shape as public-lead.routes.js.
const router = express.Router();

router.get("/pathways", getPublicPathways);
router.get("/pathways/:idOrSlug", getPublicPathway);

// Projects = for-sale `type: "project"` assessments (see public-project.service.js). The
// bootcamp/project catalog endpoints removed 4 Sep 2026 read the `courses` table; this is a
// different, deliberate feature — a project assessment an admin flips "for sale" in the builder.
router.get("/projects", getPublicProjects);
router.get("/projects/:idOrSlug", getPublicProject);

module.exports = router;
