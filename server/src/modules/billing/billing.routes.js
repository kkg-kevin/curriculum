const express = require("express");
const {
  listInvoices, getInvoice, createInvoice, updateInvoice, issueInvoice, emailInvoice, cancelInvoice, recordPayment, setInstalments, listBatches, previewBulkInvoices, createBulkInvoices, listReceipts, getReceipt, getStatement, listCustomers, getCustomer,
} = require("./billing.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");
const MpesaController = require("../payments/mpesa/mpesa.controller");
// Home Learning packages (what families are billed monthly, and what the website's Home Schooling
// page shows) are managed from Billing → Packages, so they live here and are gated by Billing
// permissions. Same controller and rules as before — only the address and the owning module moved.
const { listPackages, createPackage, updatePackage, deletePackage } = require("../home-learning/home-learning.controller");
// Estate Tech Club packages sit beside them (Billing → Packages → Tech Clubs), same gating.
const ClubController = require("../tech-clubs/club.controller");

const router = express.Router();

// Registered before "/:id" so "packages" isn't read as an invoice id.
router.get("/packages", authorize("admin"), listPackages);
router.post("/packages", authorize("admin"), createPackage);
router.put("/packages/:packageId", authorize("admin"), updatePackage);
router.delete("/packages/:packageId", authorize("admin"), deletePackage);
router.get("/club-packages", authorize("admin"), ClubController.listPackages);
router.post("/club-packages", authorize("admin"), ClubController.createPackage);
router.put("/club-packages/:packageId", authorize("admin"), ClubController.updatePackage);
router.delete("/club-packages/:packageId", authorize("admin"), ClubController.deletePackage);

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
router.post("/:id/email", authorize("admin", "school"), emailInvoice);
router.post("/:id/cancel", authorize("admin", "school"), cancelInvoice);
router.post("/:id/payments", authorize("admin", "school"), recordPayment);
// Part payments: the invoice's payment schedule (a plan, parts typed by hand, or none).
router.put("/:id/instalments", authorize("admin", "school"), setInstalments);
// Pay with M-Pesa (a parent, on their own invoice) and Request payment (staff) — both send the
// "enter your PIN" prompt to a phone. See modules/payments/mpesa/.
router.post("/:id/mpesa", authorize("admin", "school", "learner"), MpesaController.initiateForInvoice);
router.get("/:invoiceId/payments/:paymentId", authorize("admin", "school", "learner"), getReceipt);

module.exports = router;
