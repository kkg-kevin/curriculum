const express = require("express");
const rateLimit = require("express-rate-limit");
const { authorize } = require("../../shared/middleware/auth.middleware");
const Controller = require("./payment-notices.controller");

// Billing → To confirm. Mounted at /api/billing/payment-notices (app.js), before billing's "/:id"
// routes, so staff access follows their Billing permissions (access.registry.js).
const staffRouter = express.Router();
staffRouter.get("/", authorize("admin"), Controller.list);
staffRouter.post("/:id/confirm", authorize("admin"), Controller.confirm);
staffRouter.post("/:id/reject", authorize("admin"), Controller.reject);

// "I've paid" from the website's Payment step. Mounted at /api/public/payments beside the
// M-Pesa link routes (the token opens one invoice; payments/payment-links.js).
const publicRouter = express.Router();
const noticeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many attempts from here. Please try again later." },
});
publicRouter.post("/:token/notices", noticeLimiter, Controller.submitForLink);
// Choosing how to pay it: one of the plans offered (part payments), or the whole amount at once.
publicRouter.post("/:token/plan", noticeLimiter, Controller.choosePlanForLink);

// Settings → Payments → How families can pay. Owner only — mounted in app.js with the same
// guards as the rest of /api/payment-settings.
const optionsRouter = express.Router();
optionsRouter.route("/").get(Controller.getOptions).put(Controller.saveOptions);

module.exports = { staffRouter, publicRouter, optionsRouter };
