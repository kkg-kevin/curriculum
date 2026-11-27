const express = require("express");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const CreditService = require("./credit.service");
const { contextOf } = require("../mentor-bookings/mentor-booking.service");

// /api/family-credits — mounted in app.js behind protect + attachOwnRecords.
//   parents      GET /mine, POST /buy, PUT /children/:learnerId (switch a child on/off, monthly limit)
//   a child      GET /child (the credits they can use)
//   staff        GET /wallets, GET /wallets/:id, POST /wallets/:id/adjust — the workspace's
//                admins, and staff with Mentor bookings (access.registry.js); adjusting needs Edit
// Named routes before "/:id".

const router = express.Router();
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

function parse(schema, input) {
  const result = schema.safeParse(input || {});
  if (!result.success) throw Object.assign(new Error(result.error.issues[0]?.message || "Please check the details"), { statusCode: 400 });
  return result.data;
}

const isParent = (req) => req.user.role === "learner" && !req.user.username && !req.user.totLearner;
const isChild = (req) => req.user.role === "learner" && !!req.user.username && !req.user.totLearner;
const parentOnly = (req, res, next) => (isParent(req) ? next() : next(fail("For parents", 403)));

router.get("/mine", parentOnly, asyncHandler(async (req, res) => ok(res, await CreditService.mine(req))));
router.post("/buy", parentOnly, asyncHandler(async (req, res) => {
  const body = parse(z.object({ amount: z.coerce.number().int().positive("Choose how many credits"), ownerAdminId: z.string().max(64).nullable().optional() }), req.body);
  ok(res, await CreditService.buy(req, body), 201);
}));
router.put("/children/:learnerId", parentOnly, asyncHandler(async (req, res) => {
  const body = parse(z.object({
    ownerAdminId: z.string().min(1).max(64),
    allowed: z.boolean(),
    monthlyLimit: z.union([z.coerce.number().int().min(0).max(1000000), z.null()]).optional().default(null),
  }), req.body);
  ok(res, await CreditService.setChildRule(req, req.params.learnerId, body));
}));

router.get("/child", asyncHandler(async (req, res) => {
  if (!isChild(req)) throw fail("For learners", 403);
  ok(res, await CreditService.childSummary(req));
}));

// Staff
const manager = asyncHandler(async (req, res, next) => {
  if (req.user.role !== "admin") throw fail("You do not have permission to perform this action", 403);
  req.creditCtx = { ...(await contextOf(req)), ownerAdminId: req.ownerAdminId };
  next();
});
router.get("/wallets", manager, asyncHandler(async (req, res) => ok(res, await CreditService.listWallets(req.creditCtx))));
router.get("/wallets/:id", manager, asyncHandler(async (req, res) => ok(res, await CreditService.walletDetail(req.creditCtx, req.params.id))));
router.post("/wallets/:id/adjust", manager, asyncHandler(async (req, res) => {
  const body = parse(z.object({ amount: z.coerce.number().min(-1000000).max(1000000), note: z.string().max(500) }), req.body);
  ok(res, await CreditService.adjust(req.creditCtx, req.params.id, body));
}));

module.exports = router;
