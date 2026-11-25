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

// ---- Prospects (19 Nov 2026 — affiliate.prospects.js): families an affiliate pre-registers ---------
const PROGRAMME_KEYS = ["home_learning", "tech_club", "pathway", "bootcamp", "shop"];
const optionalText = (max) => z.union([z.string().trim().max(max), z.null()]).optional().transform((v) => (v ? v : null));
const prospectSchema = z.object({
  parentName: z.string().trim().min(2, "Enter the parent's name").max(150),
  phone: optionalText(40),
  email: z.union([z.string().trim().email("Enter a valid email address").max(255), z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
  childName: optionalText(150),
  childAge: z.union([z.coerce.number().int().min(2).max(25), z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v)),
  programme: z.union([z.enum(PROGRAMME_KEYS), z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
  notes: optionalText(1000),
  // The affiliate confirms the family agreed to be contacted (Data Protection Act).
  consent: z.literal(true, { error: "Confirm the family agreed to be contacted by Digifunzi" }),
}).superRefine((v, ctx) => {
  if (!v.phone && !v.email) ctx.addIssue({ code: "custom", path: ["phone"], message: "Give the parent's phone number or email" });
});
const prospectEditSchema = z.object({
  childName: optionalText(150),
  childAge: z.union([z.coerce.number().int().min(2).max(25), z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v)),
  programme: z.union([z.enum(PROGRAMME_KEYS), z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
  notes: optionalText(1000),
});
// A spreadsheet's rows: each is checked by itself (a bad row is reported, the rest still added).
const bulkSchema = z.object({
  consent: z.literal(true, { error: "Confirm every family agreed to be contacted by Digifunzi" }),
  rows: z.array(z.record(z.string(), z.any())).min(1, "The file has no families in it").max(200, "Up to 200 families at a time"),
});
const rowOf = (r) => ({
  parentName: String(r.parentName || "").trim(), phone: r.phone ? String(r.phone).trim() : null, email: r.email ? String(r.email).trim() : null,
  childName: r.childName ? String(r.childName).trim() : null, childAge: r.childAge ? Number(r.childAge) || null : null,
  programme: PROGRAMME_KEYS.includes(r.programme) ? r.programme : null, notes: r.notes ? String(r.notes).trim() : null,
});
router.get("/me/prospects", own, asyncHandler(async (req, res) => ok(res, await AffiliateService.myProspects(req))));
router.post("/me/prospects", own, asyncHandler(async (req, res) => ok(res, await AffiliateService.addMyProspect(req, prospectSchema.parse(req.body || {})))));
router.post("/me/prospects/bulk", own, asyncHandler(async (req, res) => {
  const { rows } = bulkSchema.parse(req.body || {});
  ok(res, await AffiliateService.addMyProspects(req, rows.map(rowOf)));
}));
router.put("/me/prospects/:id", own, asyncHandler(async (req, res) => ok(res, await AffiliateService.updateMyProspect(req, req.params.id, prospectEditSchema.parse(req.body || {})))));
router.post("/me/prospects/:id/release", own, asyncHandler(async (req, res) => ok(res, await AffiliateService.releaseMyProspect(req, req.params.id))));
router.post("/me/prospects/:id/invite", own, asyncHandler(async (req, res) => {
  const { channel } = z.object({ channel: z.enum(["whatsapp", "email"]) }).parse(req.body || {});
  ok(res, await AffiliateService.inviteMyProspect(req, req.params.id, channel));
}));

// ---- Admin -------------------------------------------------------------------------------------
const admin = authorize("admin");
router.get("/settings", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.getSettings(req.ownerAdminId))));
router.put("/settings", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.saveSettings(req.ownerAdminId, req.body || {}))));

// Prospects: every claim; adding one for an affiliate; releasing, moving, deciding possible matches.
router.get("/prospects", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.listProspects(req, { filter: req.query.filter || null, affiliateId: req.query.affiliateId || null }))));
router.post("/prospects", admin, asyncHandler(async (req, res) => {
  const { affiliateId } = z.object({ affiliateId: z.string().trim().min(1, "Choose the affiliate").max(36) }).parse(req.body || {});
  ok(res, await AffiliateService.addProspectFor(req, affiliateId, prospectSchema.parse(req.body || {})));
}));
router.get("/prospects/:id", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.prospect(req, req.params.id))));
router.post("/prospects/:id/notes", admin, asyncHandler(async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1, "Write the note first").max(2000) }).parse(req.body || {});
  ok(res, await AffiliateService.addProspectNote(req, req.params.id, body));
}));
router.delete("/prospects/:id/notes/:noteId", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.deleteProspectNote(req, req.params.id, req.params.noteId))));
router.put("/prospects/:id/follow-up", admin, asyncHandler(async (req, res) => {
  const { date } = z.object({ date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date"), z.null()]) }).parse(req.body || {});
  ok(res, await AffiliateService.setProspectFollowUp(req, req.params.id, date));
}));
router.post("/prospects/:id/release", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.releaseProspect(req, req.params.id))));
router.post("/prospects/:id/reassign", admin, asyncHandler(async (req, res) => {
  const { affiliateId } = z.object({ affiliateId: z.string().trim().min(1).max(36) }).parse(req.body || {});
  ok(res, await AffiliateService.reassignProspect(req, req.params.id, affiliateId));
}));
router.post("/prospects/:id/match", admin, asyncHandler(async (req, res) => {
  const { approve } = z.object({ approve: z.boolean() }).parse(req.body || {});
  ok(res, await AffiliateService.decideProspectMatch(req, req.params.id, approve));
}));

// Monthly targets (25 Nov 2026): every affiliate's standing in a month (?month=YYYY-MM, default now).
router.get("/targets", admin, asyncHandler(async (req, res) => ok(res, await AffiliateService.targetsBoard(req, req.query.month ? String(req.query.month) : null))));

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
  // Teams and their own deal (12 Nov 2026): a manager (level 1), the manager they're under, and
  // rates of their own — left out = unchanged; a rate left empty follows Settings.
  isManager: z.boolean().optional(),
  managerId: z.string().trim().max(36).optional().nullable(),
  customRates: z.object({
    rates: z.record(z.string(), z.union([z.number(), z.string(), z.null()])).optional(),
    periods: z.union([z.number(), z.string(), z.null()]).optional(),
    teamRate: z.union([z.number(), z.string(), z.null()]).optional(),
  }).optional().nullable(),
  // Monthly targets of their own (25 Nov 2026) — an empty box follows Settings; team ones for managers.
  targets: z.object({
    money: z.union([z.number(), z.string(), z.null()]).optional(),
    families: z.union([z.number(), z.string(), z.null()]).optional(),
    teamMoney: z.union([z.number(), z.string(), z.null()]).optional(),
    teamFamilies: z.union([z.number(), z.string(), z.null()]).optional(),
  }).optional().nullable(),
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
publicRouter.get("/affiliate-programme", asyncHandler(async (req, res) => ok(res, await AffiliateService.publicProgramme({ teamCode: req.query.team ? String(req.query.team) : null }))));
// An application (people who aren't users). Honeypot `hp_field`; terms must be accepted.
const applicationSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(150),
  email: z.string().trim().email("Enter a valid email address").max(255),
  phone: z.string().trim().min(9, "Enter your phone number").max(40),
  promotion: z.string().trim().max(2000).optional().nullable(),
  payoutMethod: z.enum(["mpesa", "bank"]),
  payoutPhone: z.string().trim().max(40).optional().nullable(),
  payoutDetails: z.string().trim().max(500).optional().nullable(),
  // A manager's recruit link (?team=CODE): they join that manager's team once approved.
  teamCode: z.string().trim().max(40).optional().nullable(),
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
// A family's "no thanks" link from an invite (the portal's /no-thanks/:token page): their claim
// closes and their details are removed. Rate-limited; says nothing about anyone else.
publicRouter.post("/affiliate-prospects/opt-out/:token", limiter, asyncHandler(async (req, res) => ok(res, await AffiliateService.optOutProspect(req.params.token))));
publicRouter.post("/affiliate-dashboard/payouts", dashboardMoved);

module.exports = { router, publicRouter };
