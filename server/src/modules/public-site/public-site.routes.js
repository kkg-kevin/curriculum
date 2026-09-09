const express = require("express");
const { getPublicPathways, getPublicPathway } = require("./public-site.controller");
const { getPublicProjects, getPublicProject } = require("./public-project.controller");
const { getPublicStoreItems, getPublicStoreItem } = require("./public-store.controller");

// Unauthenticated by design — digifunzi-landing's Pathways, Projects and Store pages (see the
// integration contract). Mounted at /api/public, same shape as public-lead.routes.js.
const router = express.Router();

router.get("/pathways", getPublicPathways);
router.get("/pathways/:idOrSlug", getPublicPathway);

// Projects = for-sale `type: "project"` assessments (see public-project.service.js). The
// bootcamp/project catalog endpoints removed 4 Sep 2026 read the `courses` table; this is a
// different, deliberate feature — a project assessment an admin flips "for sale" in the builder.
router.get("/projects", getPublicProjects);
router.get("/projects/:idOrSlug", getPublicProject);

// Store = for-sale rows of the shared `inventory` catalog (see public-store.service.js) — the
// Quarky robot, kits, accessories. An admin flips an inventory item "for sale" in the portal's
// Inventory panel and it appears here.
router.get("/store", getPublicStoreItems);
router.get("/store/:idOrSlug", getPublicStoreItem);

module.exports = router;
