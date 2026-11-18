const express = require("express");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const db = require("../../config/db");
const RankingService = require("./ranking.service");
const R = require("./ranking.rules");
const { learnerAnalytics } = require("./learner-analytics");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

// /api/rankings — mounted behind protect + attachOwnRecords (staff: Settings for /settings,
// Learners for /learner/…, Classes for the rest — access.registry.js).
//   GET /me?classId=                 a learner's own place, score, badges and boards — the learner's
//                                    login, or a parent looking at a child (req.ownLearner follows
//                                    X-Active-Learner-Id)
//   GET /me/analytics?period=        their analytics (term | year), in level words
//   GET /learner/:id/analytics       a learner's analytics for staff, their educators and their hub
//   GET /class/:classId              the whole class, for its educators, its hub, supervisors of an
//                                    educator teaching it, and the workspace's admins and staff
//   GET|PUT /settings                Settings → Rankings (admins; staff with Settings)

const router = express.Router();
const periodOf = (q) => (q.period === "year" ? "year" : "term");
const refuse = (res) => res.status(403).json({ success: false, message: "Only learners and their parents see this" });

router.get("/me", asyncHandler(async (req, res) => {
  if (req.user.role !== "learner") return refuse(res);
  res.json({ success: true, data: await RankingService.forLearner(req.ownLearner, typeof req.query.classId === "string" ? req.query.classId : null) });
}));

// The key things for every class — the profile's "This term" strip.
router.get("/me/summary", asyncHandler(async (req, res) => {
  if (req.user.role !== "learner") return refuse(res);
  res.json({ success: true, data: await RankingService.summaryFor(req.ownLearner) });
}));

// A parent's children, one summary each — the parent home's line per child. (A child's own login
// gets just themself.)
router.get("/family", asyncHandler(async (req, res) => {
  if (req.user.role !== "learner") return refuse(res);
  const children = req.ownLearners || (req.ownLearner ? [req.ownLearner] : []);
  const data = [];
  for (const child of children) data.push(await RankingService.summaryFor(child));
  res.json({ success: true, data });
}));

router.get("/me/analytics", asyncHandler(async (req, res) => {
  if (req.user.role !== "learner") return refuse(res);
  if (!req.ownLearner) return res.status(403).json({ success: false, message: "No learner is linked to this account" });
  res.json({ success: true, data: await learnerAnalytics(req.ownLearner, { staff: false, period: periodOf(req.query) }) });
}));

async function adminOwnsHub(req, hubId) {
  if (!hubId) return false;
  const hub = await db("learning_hubs").where({ id: hubId }).first("ownerAdminId");
  return Boolean(hub && hub.ownerAdminId === req.ownerAdminId);
}

async function assertClassAccess(req, cls) {
  if (!cls) throw Object.assign(new Error("Class not found"), { statusCode: 404 });
  const role = req.user.role;
  if (role === "admin") return assertOwn(await adminOwnsHub(req, cls.schoolId));
  if (role === "school") return assertOwn(cls.schoolId === req.ownSchool?.id);
  if (role === "teacher") {
    const link = req.ownTeacher ? await db("class_course_teacher_links").where({ classId: cls.id, teacherId: req.ownTeacher.id }).first("id") : null;
    return assertOwn(Boolean(link) || cls.classTeacherId === req.ownTeacher?.id);
  }
  if (role === "supervisor") {
    const educators = await db("teachers").where({ supervisorId: req.user.id }).whereNot({ status: "removed" }).pluck("id");
    const link = educators.length ? await db("class_course_teacher_links").where({ classId: cls.id }).whereIn("teacherId", educators).first("id") : null;
    return assertOwn(Boolean(link));
  }
  return assertOwn(false);
}

// A learner is staff's to see when they have a place at one of the workspace's hubs (or the
// workspace made them); an educator's when they're in a class the educator teaches; a hub's when
// they have a place at it.
async function assertLearnerAccess(req, learner) {
  if (!learner) throw Object.assign(new Error("Learner not found"), { statusCode: 404 });
  const links = await db("learner_hub_links").where({ learnerId: learner.id });
  const role = req.user.role;
  if (role === "admin") {
    if (learner.createdByAdminId && learner.createdByAdminId === req.ownerAdminId) return;
    for (const l of links) if (await adminOwnsHub(req, l.hubId)) return;
    return assertOwn(false);
  }
  if (role === "school") return assertOwn(links.some((l) => l.hubId === req.ownSchool?.id));
  if (role === "teacher") {
    const classIds = links.map((l) => l.classId).filter(Boolean);
    const link = req.ownTeacher && classIds.length ? await db("class_course_teacher_links").whereIn("classId", classIds).where({ teacherId: req.ownTeacher.id }).first("id") : null;
    return assertOwn(Boolean(link));
  }
  return assertOwn(false);
}

router.get("/learner/:learnerId/analytics", asyncHandler(async (req, res) => {
  const learner = await db("learners").where({ id: req.params.learnerId }).first();
  await assertLearnerAccess(req, learner);
  res.json({ success: true, data: await learnerAnalytics(learner, { staff: true, period: periodOf(req.query) }) });
}));

router.get("/learner/:learnerId/summary", asyncHandler(async (req, res) => {
  const learner = await db("learners").where({ id: req.params.learnerId }).first();
  await assertLearnerAccess(req, learner);
  res.json({ success: true, data: await RankingService.summaryFor(learner, { staff: true }) });
}));

router.get("/class/:classId", asyncHandler(async (req, res) => {
  const cls = await db("classes").where({ id: req.params.classId }).first();
  await assertClassAccess(req, cls);
  res.json({ success: true, data: await RankingService.forClass(cls.id) });
}));

// ---- Settings → Rankings ----------------------------------------------------------------------
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use dates like 2026-09-01");
const settingsSchema = z.object({
  enabled: z.boolean(),
  disabledHubIds: z.array(z.string().max(36)).max(500),
  weights: z.object(Object.fromEntries(R.PARTS.map(({ key }) => [key, z.coerce.number().min(0).max(100)]))),
  minMarked: z.coerce.number().int().min(1).max(50),
  minClass: z.coerce.number().int().min(2).max(100),
  nameStyle: z.enum(R.NAME_STYLES),
  period: z.enum(R.PERIODS),
  terms: z.array(z.object({ name: z.string().trim().min(1, "Name every term").max(60), from: day, to: day })).max(20),
}).superRefine((v, ctx) => {
  if (!Object.values(v.weights).some((w) => w > 0)) ctx.addIssue({ code: "custom", path: ["weights"], message: "At least one part of the score needs a weight above 0" });
  v.terms.forEach((t, i) => { if (t.from > t.to) ctx.addIssue({ code: "custom", path: ["terms", i], message: `"${t.name}" ends before it starts` }); });
  const sorted = [...v.terms].sort((a, b) => a.from.localeCompare(b.from));
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].from <= sorted[i - 1].to) ctx.addIssue({ code: "custom", path: ["terms"], message: `"${sorted[i - 1].name}" and "${sorted[i].name}" overlap` });
  }
});

const adminOnly = (req, res, next) => (req.user.role === "admin" ? next() : res.status(403).json({ success: false, message: "Only admins change rankings settings" }));

router.get("/settings", adminOnly, asyncHandler(async (req, res) => {
  const hubs = await db("learning_hubs").where({ ownerAdminId: req.ownerAdminId }).whereNot({ status: "removed" }).select("id", "name").orderBy("name");
  res.json({ success: true, data: { settings: await RankingService.settingsFor(req.ownerAdminId), hubs, parts: R.PARTS, defaults: R.DEFAULT_SETTINGS, badges: R.BADGES } });
}));

router.put("/settings", adminOnly, asyncHandler(async (req, res) => {
  const data = settingsSchema.parse(req.body);
  res.json({ success: true, data: { settings: await RankingService.saveSettings(req.ownerAdminId, data) } });
}));

module.exports = router;
