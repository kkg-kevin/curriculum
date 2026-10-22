const express = require("express");
const rateLimit = require("express-rate-limit");
const { authorize } = require("../../../shared/middleware/auth.middleware");
const MpesaController = require("./mpesa.controller");

// Mounted at /api/billing/mpesa, so staff access follows their Billing permissions
// (access.registry.js maps everything under /api/billing to Billing).
const router = express.Router();

router.get("/status", authorize("admin", "school", "learner"), MpesaController.status);
router.get("/requests/:requestId", authorize("admin", "school", "learner"), MpesaController.getRequest);
router.get("/transactions", authorize("admin"), MpesaController.listTransactions);
router.get("/failed-requests", authorize("admin"), MpesaController.listFailedRequests);
router.post("/transactions/:id/allocate", authorize("admin"), MpesaController.allocateTransaction);
router.post("/transactions/:id/ignore", authorize("admin"), MpesaController.ignoreTransaction);
// Asking Safaricom about a transaction, and sending one back — answered later (mpesa.operations.js).
router.post("/transactions/:id/check", authorize("admin"), MpesaController.checkTransaction);
router.post("/transactions/:id/reverse", authorize("admin"), MpesaController.reverseTransaction);

// Importing an M-Pesa statement: the CSV file's text as the body. Preview first, then import.
const statementBody = express.text({ type: ["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel", "application/octet-stream"], limit: "5mb" });
router.post("/statement/preview", authorize("admin"), statementBody, MpesaController.previewStatement);
router.post("/statement/import", authorize("admin"), statementBody, MpesaController.importStatement);

module.exports = router;

// Paying an invoice from a link, without signing in — the website's Pay now after a sign-up.
// Mounted at /api/public/payments (app.js). The token in the address opens one invoice's amount
// and nothing else (payments/payment-links.js). Sending a prompt is limited per address on top of
// the per-invoice limits in mpesa.service.js; polling is generous.
const publicRouter = express.Router();
const limited = (limit, message) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { success: false, message } });
const promptLimiter = limited(10, "Too many payment attempts from here. Please try again later.");
const readLimiter = limited(600, "Too many requests. Please try again later.");
publicRouter.get("/:token", readLimiter, MpesaController.linkSummary);
publicRouter.post("/:token/mpesa", promptLimiter, MpesaController.initiateForLink);
publicRouter.get("/:token/mpesa/:requestId", readLimiter, MpesaController.getRequestForLink);

// Settings → Payments: the workspace's own Paybill. Owner only — mounted in app.js with the same
// guards as /api/email-settings.
const settingsRouter = express.Router();
settingsRouter.route("/").get(MpesaController.getAccountSettings).put(MpesaController.saveAccountSettings).delete(MpesaController.removeAccountSettings);
settingsRouter.post("/test", MpesaController.testAccountSettings);
settingsRouter.post("/register-urls", MpesaController.registerAccountUrls);

module.exports.publicRouter = publicRouter;
module.exports.settingsRouter = settingsRouter;
