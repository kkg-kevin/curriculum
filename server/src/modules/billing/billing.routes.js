const express = require("express");
const {
  listInvoices, getInvoice, createInvoice, updateInvoice, issueInvoice, cancelInvoice, recordPayment,
} = require("./billing.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

router.get("/", authorize("admin", "school", "learner"), listInvoices);
router.post("/", authorize("admin", "school"), createInvoice);
router.get("/:id", authorize("admin", "school", "learner"), getInvoice);
router.patch("/:id", authorize("admin", "school"), updateInvoice);
router.post("/:id/issue", authorize("admin", "school"), issueInvoice);
router.post("/:id/cancel", authorize("admin", "school"), cancelInvoice);
router.post("/:id/payments", authorize("admin", "school"), recordPayment);

module.exports = router;
