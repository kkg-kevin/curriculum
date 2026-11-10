const express = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { authorize } = require("../../shared/middleware/auth.middleware");
const AffiliateService = require("./affiliate.service");
const { appUrl } = require("../../shared/mail/mail.layout");

// Affiliate marketing (affiliate.service.js), mounted at /api/affiliates with protect +
// attachOwnRecords (app.js). Staff reach the admin side through the Affiliates permission
// (access.registry.js); /me is the affiliate's own "Refer & earn" — a parent's or educator's in
// their portal, everyone else's signed in as Affiliate (the affiliate portal).
const router = express.Router();
const ok = (res, data) => res.json({ success: true, data });

// ---- The affiliate's own (parents, educators, and affiliates signed in as Affiliate) ------------
const own = authorize("learner", "teacher", "affiliate");
router.get("/me", own, asyncHandler(async (req, res) => ok(res, await AffiliateService.mine(req))));
router.post("/me/join", own, asyncHandler(async (req, res) => {
  const body = z.object({ payoutPhone: z.string().trim().max(40).optional() }).parse(req.body || {});
  ok(res, await AffiliateService.join(req, body));
}));
router.put("/me", own, asyncHandler(async (req, res) => {
  const body = z.object({
    payoutMethod: z.enum(["credit", "mpesa", "bank"]).optional(),
    payoutPhone: z.string().trim().max(40).optional().nullable(),
    payoutDetails: z.string().trim().max(500).optional().nullable(),
    // Signed in as Affiliate only (their details are the affiliate record's).
    name: z.string().trim().max(150).optional(),
    phone: z.string().trim().max(40).optional().nullable(),
  }).parse(req.body || {});
  ok(res, await AffiliateService.updateMine(req, body));
}));
router.post("/me/payouts", own, asyncHandler(async (req, res) => ok(res, await AffiliateService.requestMyPayout(req))));

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
  // Someone already on Digifunzi (GET /people): their name and email come from their login.
  userId: z.string().trim().max(36).optional().nullable(),
  name: z.string().trim().max(150).optional(),
  email: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  code: z.string().trim().max(40).optional().nullable(),
  status: z.enum(["pending", "active", "suspended"]).optional(),
  payoutMethod: z.enum(["credit", "mpesa", "bank"]).optional(),
  payoutPhone: z.string().trim().max(40).optional().nullable(),
  payoutDetails: z.string().trim().max(500).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});
router.get("/", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.listAffiliates(req))));
// Search this workspace's people who already have a login (parents, educators, hub logins, staff).
router.get("/people", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.searchPeople(req, req.query.q))));
router.post("/", admin, asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await AffiliateService.createAffiliate(req, affiliateSchema.parse(req.body || {})) });
}));
router.put("/:id", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.updateAffiliate(req, req.params.id, affiliateSchema.parse(req.body || {})))));
router.delete("/:id", admin, asyncHandler(async (req, res) => { await AffiliateService.deleteAffiliate(req, req.params.id); ok(res, null); }));
router.get("/:id/open-invoices", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.openInvoicesFor(req, req.params.id))));
router.post("/:id/payouts", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.createPayout(req, req.params.id))));
// Emails an affiliate who signs in as Affiliate how to sign in (a one-time set-password link,
// only ever to their own address — never shown here). Makes their login first if they have none.
router.post("/:id/sign-in-details", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.sendSignInDetails(req, req.params.id))));

// ---- The website (no sign-in) ------------------------------------------------------------------
const publicRouter = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many tries. Please try again later." },
});
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
// The private dashboard links (6 Nov 2026) are gone — affiliates sign in to their account. An old
// link (or an older website) is told where to go.
const dashboardMoved = (req, res) => res.status(410).json({
  success: false,
  code: "AFFILIATE_DASHBOARD_MOVED",
  message: "Your affiliate dashboard is now your Digifunzi account — sign in with your email. First time? Use \"Forgot password?\" to set your password.",
  data: { signInUrl: appUrl("/login"), setPasswordUrl: appUrl("/forgot-password") },
});
publicRouter.get("/affiliate-dashboard", dashboardMoved);
publicRouter.post("/affiliate-dashboard/payouts", dashboardMoved);

module.exports = { router, publicRouter };
