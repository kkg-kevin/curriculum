const express = require("express");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { authorize } = require("../../shared/middleware/auth.middleware");
const Cases = require("./analytics.cases");
const R = require("./analytics.cases.rules");

// /api/followups — learner follow-up cases (26 Nov 2026, analytics.cases.js). Admins and staff with
// Reports (access.registry.js), a hub's login (its own hub) and educators (cases they own or for
// learners of classes they teach). Each case is checked against the viewer in the service.

const router = express.Router();
router.use(authorize("admin", "school", "teacher"));
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const actionSchema = z.object({
  action: z.enum(["message_parent", "tell_educators", "note", "status", "escalate", "assign"]),
  message: z.string().max(2000).optional(),
  note: z.string().max(2000).optional(),
  status: z.enum(Object.keys(R.STATUSES)).optional(),
  outcome: z.enum(Object.keys(R.OUTCOMES)).optional(),
  ownerUserId: z.union([z.string().max(36), z.null()]).optional(),
});
const openSchema = z.object({ learnerId: z.string().min(1).max(36), note: z.string().trim().min(3, "Say what needs following up").max(1000) });

router.get("/cases", asyncHandler(async (req, res) => ok(res, await Cases.list(req, {
  view: String(req.query.view || "open"), reason: String(req.query.reason || ""), hubId: String(req.query.hubId || ""), learnerId: String(req.query.learnerId || ""),
}))));
router.post("/cases", asyncHandler(async (req, res) => ok(res, await Cases.openManual(req, openSchema.parse(req.body || {})), 201)));
router.get("/cases/:id", asyncHandler(async (req, res) => ok(res, await Cases.detail(req, req.params.id))));
router.post("/cases/:id/actions", asyncHandler(async (req, res) => ok(res, await Cases.act(req, req.params.id, actionSchema.parse(req.body || {})))));

module.exports = router;
