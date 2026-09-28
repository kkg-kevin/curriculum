const express = require("express");
const { authorize } = require("../../shared/middleware/auth.middleware");
const controller = require("./home-learning.controller");

const router = express.Router();
router.get("/", authorize("admin"), controller.list);
router.get("/packages", authorize("admin"), controller.listPackages);
router.post("/packages", authorize("admin"), controller.createPackage);
router.put("/packages/:packageId", authorize("admin"), controller.updatePackage);
router.delete("/packages/:packageId", authorize("admin"), controller.deletePackage);
router.get("/educator", authorize("teacher"), controller.getForEducator);
router.get("/learner/:learnerId", authorize("learner"), controller.getForLearner);
router.post("/", authorize("admin"), controller.create);
router.post("/invoices", authorize("admin"), controller.generateMonthlyInvoices);
router.put("/:id", authorize("admin"), controller.update);
router.post("/:id/learners", authorize("admin"), controller.setEnrollment);
router.post("/:id/learners/new", authorize("admin"), controller.createLearner);
router.delete("/:id/learners/:learnerId", authorize("admin"), controller.removeEnrollment);
router.post("/:id/invoices", authorize("admin"), controller.generateInvoice);

module.exports = router;
