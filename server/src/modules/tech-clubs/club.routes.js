const express = require("express");
const { authorize } = require("../../shared/middleware/auth.middleware");
const controller = require("./club.controller");

// Mounted at /api/tech-clubs. Packages are created and edited from Billing → Packages
// (/api/billing/club-packages, see billing.routes.js); this read is for the membership forms.
const router = express.Router();
router.get("/", authorize("admin"), controller.list);
router.get("/clubs", authorize("admin"), controller.listClubs);
router.get("/packages", authorize("admin"), controller.listPackages);
// A parent fills the free places in their membership with more children (parent login only).
router.get("/family", authorize("learner"), controller.getFamily);
router.post("/family/:membershipId/children", authorize("learner"), controller.addFamilyChild);
router.post("/invoices", authorize("admin"), controller.generateMonthlyInvoices);
router.put("/:id", authorize("admin"), controller.update);
router.put("/:id/children/:learnerId", authorize("admin"), controller.placeChild);
router.post("/:id/children/:learnerId/restore", authorize("admin"), controller.restoreChild);
router.delete("/:id/children/:learnerId", authorize("admin"), controller.removeChild);
router.post("/:id/invoices", authorize("admin"), controller.generateInvoice);
router.post("/:id/approve-payment", authorize("admin"), controller.approveSignup);
router.post("/:id/decline-signup", authorize("admin"), controller.declineSignup);

module.exports = router;
