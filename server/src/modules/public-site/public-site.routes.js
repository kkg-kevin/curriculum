const express = require("express");
const { getPublicPathways, getPublicPathway } = require("./public-site.controller");
const { getPublicProjects, getPublicProject } = require("./public-project.controller");
const { getPublicStoreItems, getPublicStoreItem } = require("./public-store.controller");
const { getPublicBootcamps, getPublicBootcamp, getPublicRunHub } = require("./public-bootcamp.controller");
const { getPublicHubTypes, getPublicHubs } = require("./public-hub.controller");
const { getPublicCompetitions, getPublicCompetition } = require("./public-competition.controller");
const HomeLearningService = require("../home-learning/home-learning.service");
const asyncHandler = require("express-async-handler");
const rateLimit = require("express-rate-limit");
const HomeLearningSignupService = require("../home-learning/home-learning-signup.service");

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

// Bootcamps = its own standalone `bootcamps` table (see public-bootcamp.service.js), optionally
// linked to an Event via eventId — NOT the old `public_bootcamps` marketing table removed
// 4 Sep 2026, nor the bolted-onto-curricula sale flag it briefly was before this module existed.
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

// A single hub's full profile — reachable only from a bootcamp's "Running at" list (see
// public-bootcamp.service.js's getHub()), not part of the enrolment-picker hub set above.
router.get("/hubs/:id", getPublicRunHub);

// Competitions = the designated admin's `competitions` rows marked isPublic (see
// public-competition.service.js) — the Track cards on africa.digifunzi.com/competitions.
router.get("/competitions", getPublicCompetitions);
router.get("/competitions/:idOrSlug", getPublicCompetition);

// Home Learning packages = the designated admin's packages marked "Show on website" in the
// portal's Home Learning → Packages (see home-learning.service.js). The same records households
// are sold and invoiced on, so the website's cards can't drift from billing. Bare array/object,
// like every other public endpoint; 404 for an unknown, unpublished or archived package.
router.get("/home-learning/packages", asyncHandler(async (req, res) => {
  res.json(await HomeLearningService.listPublicPackages());
}));
router.get("/home-learning/packages/:idOrSlug", asyncHandler(async (req, res) => {
  const pkg = await HomeLearningService.getPublicPackage(req.params.idOrSlug);
  if (!pkg) return res.status(404).json({ message: "Package not found" });
  res.json(pkg);
}));

// Home Learning sign-up — a family creates their household, parent login and children's logins
// here, locked until an admin approves their payment (see home-learning-signup.service.js). It
// creates accounts, so it gets the same bot/abuse rate limit as the bootcamp enrollment form.
const homeLearningSignupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many sign-ups from here. Please try again later." },
});
router.post("/home-learning/signups", homeLearningSignupLimiter, asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await HomeLearningSignupService.signup(req.body) });
}));

module.exports = router;
