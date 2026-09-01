const express = require("express");
const {
  listInvoices, getInvoice, createInvoice, updateInvoice, issueInvoice, cancelInvoice, recordPayment, listBatches, previewBulkInvoices, createBulkInvoices, listReceipts, getReceipt, getStatement, listCustomers, getCustomer,
} = require("./billing.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

router.get("/", authorize("admin", "school", "learner"), listInvoices);
router.post("/", authorize("admin", "school"), createInvoice);
router.get("/batches", authorize("admin", "school"), listBatches);
router.post("/batches/preview", authorize("admin", "school"), previewBulkInvoices);
router.post("/batches", authorize("admin", "school"), createBulkInvoices);
// Registered before "/:id" — a single-segment GET route further down would otherwise swallow
// these (Express matches "/receipts" against "/:id" too; same reason "/batches" is up here).
router.get("/receipts", authorize("admin", "school", "learner"), listReceipts);
router.get("/customers", authorize("admin"), listCustomers);
router.get("/customers/:hubId", authorize("admin"), getCustomer);
router.get("/statements/:payerType/:payerId", authorize("admin", "school", "learner"), getStatement);
router.get("/:id", authorize("admin", "school", "learner"), getInvoice);
router.patch("/:id", authorize("admin", "school"), updateInvoice);
router.post("/:id/issue", authorize("admin", "school"), issueInvoice);
router.post("/:id/cancel", authorize("admin", "school"), cancelInvoice);
router.post("/:id/payments", authorize("admin", "school"), recordPayment);
router.get("/:invoiceId/payments/:paymentId", authorize("admin", "school", "learner"), getReceipt);

module.exports = router;
