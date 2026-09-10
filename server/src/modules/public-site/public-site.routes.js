const express = require("express");
const { getPublicPathways, getPublicPathway } = require("./public-site.controller");
const { getPublicProjects, getPublicProject } = require("./public-project.controller");
const { getPublicStoreItems, getPublicStoreItem } = require("./public-store.controller");
const { getPublicBootcamps, getPublicBootcamp } = require("./public-bootcamp.controller");
const { getPublicHubTypes, getPublicHubs } = require("./public-hub.controller");
const { getPublicCompetitions, getPublicCompetition } = require("./public-competition.controller");

// Unauthenticated by design — digifunzi-landing's Pathways, Projects, Store and Bootcamps pages
// (see the integration contract). Mounted at /api/public, same shape as public-lead.routes.js.
const router = express.Router();

router.get("/pathways", getPublicPathways);
router.get("/pathways/:idOrSlug", getPublicPathway);

// Projects = for-sale `type: "project"` assessments (see public-project.service.js). The
// bootcamp/project catalog endpoints removed 4 Sep 2026 read the `courses` table; this is a
// different, deliberate feature — a project assessment an admin flips "for sale" in the builder.
router.get("/projects", getPublicProjects);
router.get("/projects/:idOrSlug", getPublicProject);

// Bootcamps = for-sale program-curricula (`curricula.isProgram = 1`, see
// public-bootcamp.service.js). Reintroduced 10 Sep 2026 as a for-sale flag on the existing
// Program concept — NOT the old `public_bootcamps` marketing table removed 4 Sep 2026.
router.get("/bootcamps", getPublicBootcamps);
router.get("/bootcamps/:idOrSlug", getPublicBootcamp);

// Store = for-sale rows of the shared `inventory` catalog (see public-store.service.js) — the
// Quarky robot, kits, accessories. An admin flips an inventory item "for sale" in the portal's
// Inventory panel and it appears here.
router.get("/store", getPublicStoreItems);
router.get("/store/:idOrSlug", getPublicStoreItem);

// Hubs = the designated admin's ACTIVE, NON-SCHOOL learning hubs (co-working space, innovation
// lab, makerspace, tech club) with their operational schedule — for the enrolment flow's "Type"
// picker (see public-hub.service.js). `/types` lists the choosable types + a hub count each.
router.get("/hubs/types", getPublicHubTypes);
router.get("/hubs", getPublicHubs);

// Competitions = the designated admin's `competitions` rows marked isPublic (see
// public-competition.service.js) — the Track cards on africa.digifunzi.com/competitions.
router.get("/competitions", getPublicCompetitions);
router.get("/competitions/:idOrSlug", getPublicCompetition);

module.exports = router;
