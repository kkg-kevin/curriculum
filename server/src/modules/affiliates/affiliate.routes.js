const express = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { authorize } = require("../../shared/middleware/auth.middleware");
const AffiliateService = require("./affiliate.service");

// Affiliate marketing (affiliate.service.js), mounted at /api/affiliates with protect +
// attachOwnRecords (app.js). Staff reach the admin side through the Affiliates permission
// (access.registry.js); /me is the parent's or educator's own "Refer & earn".
const router = express.Router();
const ok = (res, data) => res.json({ success: true, data });

// ---- The affiliate's own (parents and educators) ----------------------------------------------
router.get("/me", authorize("learner", "teacher"), asyncHandler(async (req, res) => ok(res, await AffiliateService.mine(req))));
router.post("/me/join", authorize("learner", "teacher"), asyncHandler(async (req, res) => {
  const body = z.object({ payoutPhone: z.string().trim().max(40).optional() }).parse(req.body || {});
  ok(res, await AffiliateService.join(req, body));
}));
router.put("/me", authorize("learner", "teacher"), asyncHandler(async (req, res) => {
  const body = z.object({ payoutMethod: z.enum(["credit", "mpesa"]).optional(), payoutPhone: z.string().trim().max(40).optional().nullable() }).parse(req.body || {});
  ok(res, await AffiliateService.updateMine(req, body));
}));
router.post("/me/payouts", authorize("learner", "teacher"), asyncHandler(async (req, res) => ok(res, await AffiliateService.requestMyPayout(req))));

// ---- Admin -------------------------------------------------------------------------------------
const admin = authorize("admin");
router.get("/settings", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.getSettings(req.ownerAdminId))));
router.put("/settings", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.saveSettings(req.ownerAdminId, req.body || {}))));

router.get("/referrals", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.listReferrals(req, { affiliateId: req.query.affiliateId || null }))));
router.post("/referrals/:id/cancel", admin, asyncHandler(async (req, res) => {
  await AffiliateService.cancelReferral(req, req.params.id, z.object({ note: z.string().max(500).optional() }).parse(req.body || {}).note);
  ok(res, null);
}));

router.get("/commissions", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.listCommissions(req, { affiliateId: req.query.affiliateId || null, state: req.query.state || null }))));
router.post("/commissions/:id/cancel", admin, asyncHandler(async (req, res) => {
  await AffiliateService.cancelCommission(req, req.params.id, z.object({ note: z.string().max(500).optional() }).parse(req.body || {}).note);
  ok(res, null);
}));

router.get("/payouts", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.listPayouts(req, { status: req.query.status || null, affiliateId: req.query.affiliateId || null }))));
const paidSchema = z.object({
  method: z.enum(["credit", "mpesa", "bank", "cash"]),
  reference: z.string().trim().max(120).optional().nullable(),
  creditInvoiceId: z.string().trim().max(36).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});
router.post("/payouts/:id/paid", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.markPayoutPaid(req, req.params.id, paidSchema.parse(req.body || {})))));
router.post("/payouts/:id/reject", admin, asyncHandler(async (req, res) => {
  await AffiliateService.rejectPayout(req, req.params.id, z.object({ note: z.string().max(500).optional().nullable() }).parse(req.body || {}).note);
  ok(res, null);
}));

const affiliateSchema = z.object({
  name: z.string().trim().max(150).optional(),
  email: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  kind: z.enum(["parent", "educator", "other"]).optional(),
  code: z.string().trim().max(40).optional().nullable(),
  status: z.enum(["pending", "active", "suspended"]).optional(),
  payoutMethod: z.enum(["credit", "mpesa", "bank"]).optional(),
  payoutPhone: z.string().trim().max(40).optional().nullable(),
  payoutDetails: z.string().trim().max(500).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});
router.get("/", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.listAffiliates(req))));
router.post("/", admin, asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await AffiliateService.createAffiliate(req, affiliateSchema.parse(req.body || {})) });
}));
router.put("/:id", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.updateAffiliate(req, req.params.id, affiliateSchema.parse(req.body || {})))));
router.delete("/:id", admin, asyncHandler(async (req, res) => { await AffiliateService.deleteAffiliate(req, req.params.id); ok(res, null); }));
router.get("/:id/open-invoices", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.openInvoicesFor(req, req.params.id))));
router.post("/:id/payouts", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.createPayout(req, req.params.id))));
// An outside affiliate's private dashboard link: get it, email it (`send`), make a new one (`reset`).
router.post("/:id/dashboard-link", admin, asyncHandler(async (req, res) => {
  const body = z.object({ reset: z.boolean().optional(), send: z.boolean().optional() }).parse(req.body || {});
  ok(res, await AffiliateService.dashboardLink(req, req.params.id, body));
}));

// ---- The website (no sign-in) ------------------------------------------------------------------
const publicRouter = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many tries. Please try again later." },
});
// Reading a dashboard is looser (a page reloads), but still limited — the token is the only key.
const readLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many tries. Please try again later." } });
// Is a typed code real? Only yes / no, never whose it is.
publicRouter.get("/referral-codes/:code", asyncHandler(async (req, res) => ok(res, await AffiliateService.checkCode(req.params.code))));
// The "Become an affiliate" page: the offer and whether applications are open.
publicRouter.get("/affiliate-programme", asyncHandler(async (req, res) => ok(res, await AffiliateService.publicProgramme())));
// An application (people who aren't users). Honeypot `hp_field`; terms must be accepted.
const applicationSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(150),
  email: z.string().trim().email("Enter a valid email address").max(255),
  phone: z.string().trim().min(9, "Enter your phone number").max(40),
  promotion: z.string().trim().max(2000).optional().nullable(),
  payoutMethod: z.enum(["mpesa", "bank"]),
  payoutPhone: z.string().trim().max(40).optional().nullable(),
  payoutDetails: z.string().trim().max(500).optional().nullable(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please agree to the affiliate terms" }) }),
  hp_field: z.string().max(200).optional().nullable(),
}).superRefine((d, ctx) => {
  if (d.payoutMethod === "bank" && !d.payoutDetails) ctx.addIssue({ code: "custom", path: ["payoutDetails"], message: "Enter your bank, account name and number" });
});
publicRouter.post("/affiliate-applications", limiter, asyncHandler(async (req, res) => {
  const data = applicationSchema.parse(req.body || {});
  // Only a bot fills the hidden field — it's told the same thing, and nothing is saved.
  if (data.hp_field) return res.status(201).json({ success: true, data: { status: "received" } });
  res.status(201).json({ success: true, data: await AffiliateService.apply(data) });
}));
// An outside affiliate's dashboard (their private link), and asking for a payout from it.
publicRouter.get("/affiliate-dashboard", readLimiter, asyncHandler(async (req, res) => ok(res, await AffiliateService.dashboard(req.query.token))));
publicRouter.post("/affiliate-dashboard/payouts", limiter, asyncHandler(async (req, res) => {
  ok(res, await AffiliateService.requestDashboardPayout(z.object({ token: z.string().max(200) }).parse(req.body || {}).token));
}));

module.exports = { router, publicRouter };
