const express = require("express");
const rateLimit = require("express-rate-limit");
const { authorize } = require("../../shared/middleware/auth.middleware");
const Controller = require("./orders.controller");

// Website checkout — mounted at /api/public (app.js). Placing an order can create logins (when it
// has projects), so it gets the same abuse limit as the sign-up forms.
const publicRouter = express.Router();
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many orders from here. Please try again later." },
});
publicRouter.get("/checkout", Controller.checkoutOptions);
publicRouter.post("/orders", orderLimiter, Controller.placeOrder);

// Billing → Orders — mounted at /api/billing/orders, before billing's "/:id" routes, so staff
// access follows their Billing permissions (access.registry.js).
const staffRouter = express.Router();
staffRouter.get("/", authorize("admin"), Controller.list);
staffRouter.get("/:id", authorize("admin"), Controller.get);
staffRouter.post("/:id/status", authorize("admin"), Controller.updateStatus);

module.exports = { publicRouter, staffRouter };
