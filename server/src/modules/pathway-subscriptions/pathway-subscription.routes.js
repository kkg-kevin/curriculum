const express = require("express");
const asyncHandler = require("express-async-handler");
const { authorize } = require("../../shared/middleware/auth.middleware");
const PathwaySubscriptionService = require("./pathway-subscription.service");
const PathwayAccess = require("./pathway-access");
const PaymentLinks = require("../payments/payment-links");
const { PathwaySubscriptionModel } = require("./pathway-subscription.model");

// Mounted at /api/pathway-subscriptions (protect + attachOwnRecords). Staff manage plans and
// subscriptions (admin); a parent sees and renews their own; a learner (or a parent viewing a
// child) reads which pathways they may open.
const router = express.Router();
const own = (req) => req.ownerAdminId;

/* ── Plans: Billing → Packages → Pathways ─────────────────────────────── */
router.get("/packages", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await PathwaySubscriptionService.listPackages(own(req), { pathwayTemplateId: req.query.pathwayTemplateId || null }) });
}));
router.post("/packages", authorize("admin"), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await PathwaySubscriptionService.createPackage(own(req), req.body || {}) });
}));
router.put("/packages/:packageId", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await PathwaySubscriptionService.updatePackage(own(req), req.params.packageId, req.body || {}) });
}));
router.delete("/packages/:packageId", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await PathwaySubscriptionService.deletePackage(own(req), req.params.packageId) });
}));

/* ── The learner's (or a parent's child's) pathway access ─────────────── */
// GET /api/pathway-subscriptions/access — the pathways this learner may open (or had), with their
// courses: My Courses lists them even without a class.
router.get("/access", authorize("learner"), asyncHandler(async (req, res) => {
  const learnerId = req.ownLearner?.id;
  if (!learnerId) return res.json({ success: true, data: [] });
  const rows = await PathwayAccess.listForLearner(learnerId);
  const subs = await PathwaySubscriptionModel.subscriptionsOfLearner(learnerId);
  // The courses as the course cards show them (active ones only), with their session counts.
  const db = require("../../config/db");
  const courseIds = [...new Set(rows.flatMap((r) => r.courseIds))];
  const courses = courseIds.length ? await db("courses").whereIn("id", courseIds).select("id", "name", "description", "coverImage", "status") : [];
  const sessions = courseIds.length ? await db("course_sessions").whereIn("courseId", courseIds).select("courseId").count({ n: "*" }).groupBy("courseId").catch(() => []) : [];
  const countOf = new Map(sessions.map((s) => [s.courseId, Number(s.n)]));
  const byId = new Map(courses.filter((c) => (c.status || "active") === "active").map((c) => [c.id, { id: c.id, name: c.name, description: c.description, coverImage: c.coverImage, sessionCount: countOf.get(c.id) || 0 }]));
  res.json({
    success: true,
    data: rows.map((row) => {
      const sub = row.subscriptionId ? subs.find((s) => s.id === row.subscriptionId) : null;
      return {
        ...row,
        courses: row.courseIds.map((id) => byId.get(id)).filter(Boolean),
        subscriptionStatus: sub?.status || null, billingPeriod: sub?.billingPeriod || null, paidThrough: sub?.accessUntil || null,
      };
    }),
  });
}));

/* ── A parent's own subscriptions ─────────────────────────────────────── */
const parentEmail = (req) => (req.user.role === "learner" && !req.user.username ? req.user.email : null);
router.get("/mine", authorize("learner"), asyncHandler(async (req, res) => {
  const email = parentEmail(req);
  res.json({ success: true, data: email ? await PathwaySubscriptionService.forParentEmail(email) : [] });
}));
// Renew a paused subscription (or open what's owed on an active one) — the parent's Renew button.
router.post("/mine/:id/renew", authorize("learner"), asyncHandler(async (req, res) => {
  const email = parentEmail(req);
  const sub = email ? await PathwaySubscriptionModel.findById(req.params.id) : null;
  if (!sub || String(sub.guardianEmail || "").toLowerCase() !== email.toLowerCase()) {
    return res.status(404).json({ success: false, message: "Subscription not found" });
  }
  if (sub.status === "cancelled" && sub.cancelledAt && !sub.pausedAt && sub.source === "staff") {
    return res.status(400).json({ success: false, message: "This subscription was ended — contact us to start again." });
  }
  const result = await PathwaySubscriptionService.renew(sub.ownerAdminId, sub.id, { actorUserId: req.user.id });
  const pay = result.invoice ? await PaymentLinks.forWebsite(result.invoice, "pathway_subscription").catch(() => null) : null;
  res.json({ success: true, data: { ...result, pay } });
}));

/* ── Subscriptions (staff) ────────────────────────────────────────────── */
router.get("/", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await PathwaySubscriptionService.list(own(req), { status: req.query.status || null, pathwayTemplateId: req.query.pathwayTemplateId || null }) });
}));
// Every active subscription's due invoices raised now ("Invoice what's due now").
router.post("/invoices", authorize("admin"), asyncHandler(async (req, res) => {
  const counts = await require("../billing/package-billing").processPackageBilling({ ownerAdminId: own(req), kinds: ["pathway_subscription"], actorUserId: req.user.id });
  res.json({ success: true, data: counts });
}));
router.get("/:id", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await PathwaySubscriptionService.get(own(req), req.params.id) });
}));
router.patch("/:id/status", authorize("admin"), asyncHandler(async (req, res) => {
  const status = req.body?.status;
  const data = status === "active"
    ? (await PathwaySubscriptionService.renew(own(req), req.params.id, { actorUserId: req.user.id })).subscription
    : await PathwaySubscriptionService.setStatus(own(req), req.params.id, status, req.user.id);
  res.json({ success: true, data });
}));
router.put("/:id/plan", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await PathwaySubscriptionService.changePlan(own(req), req.params.id, { packageId: req.body?.packageId, billingPeriod: ["weekly", "monthly", "quarterly", "annually"].includes(req.body?.billingPeriod) ? req.body.billingPeriod : null }) });
}));
// Raise the next period's invoice now, before it starts.
router.post("/:id/invoices", authorize("admin"), asyncHandler(async (req, res) => {
  const sub = await PathwaySubscriptionModel.findById(req.params.id, own(req));
  if (!sub) return res.status(404).json({ success: false, message: "Subscription not found" });
  if (sub.status !== "active") return res.status(400).json({ success: false, message: "Only an active subscription is invoiced — switch it back on first." });
  const result = await require("../billing/package-billing").invoiceNextPeriod("pathway_subscription", sub, { actorUserId: req.user.id });
  res.json({ success: true, data: result });
}));

module.exports = router;
