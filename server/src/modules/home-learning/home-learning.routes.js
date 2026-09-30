const express = require("express");
const { authorize } = require("../../shared/middleware/auth.middleware");
const controller = require("./home-learning.controller");

const router = express.Router();
router.get("/", authorize("admin"), controller.list);
// Read-only here — the household forms pick a package from this list. Packages are created and
// edited from Billing → Packages (/api/billing/packages, see billing.routes.js).
router.get("/packages", authorize("admin"), controller.listPackages);
router.get("/educator", authorize("teacher"), controller.getForEducator);
router.get("/learner/:learnerId", authorize("learner"), controller.getForLearner);
// A parent fills the free places in their package with more children (parent login only).
router.get("/family", authorize("learner"), controller.getFamily);
router.post("/family/:householdId/children", authorize("learner"), controller.addFamilyChild);
router.post("/", authorize("admin"), controller.create);
router.post("/invoices", authorize("admin"), controller.generateMonthlyInvoices);
router.put("/:id", authorize("admin"), controller.update);
router.post("/:id/learners", authorize("admin"), controller.setEnrollment);
router.post("/:id/learners/new", authorize("admin"), controller.createLearner);
router.delete("/:id/learners/:learnerId", authorize("admin"), controller.removeEnrollment);
router.post("/:id/invoices", authorize("admin"), controller.generateInvoice);
router.post("/:id/approve-payment", authorize("admin"), controller.approveSignup);
router.post("/:id/decline-signup", authorize("admin"), controller.declineSignup);

module.exports = router;
