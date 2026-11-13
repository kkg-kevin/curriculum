const express = require("express");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { authorize } = require("../../shared/middleware/auth.middleware");
const RemovalService = require("./removal.service");

// Removing a person: deactivate → transfer → delete (removal.service.js). Admins, and staff through
// the module of the kind (access.registry.js: /api/removals/teacher → Educators, hub → Learning
// hubs, supervisor → Claim approvals, affiliate → Affiliates).
//
//   GET    /api/removals/:kind/:id              where it stands: what they hold, who can take it…
//   POST   /api/removals/:kind/:id/deactivate
//   POST   /api/removals/:kind/:id/transfer     { to, overrides: { [itemKey]: id | "cancel" | "none" } }
//   DELETE /api/removals/:kind/:id

const router = express.Router();
const admin = authorize("admin");
const KIND = new RegExp(`^(${RemovalService.KINDS.join("|")})$`);

const transferSchema = z.object({
  to: z.string().max(64).nullable().optional(),
  overrides: z.record(z.string().max(200), z.string().max(64)).optional(),
});

router.param("kind", (req, res, next, kind) => {
  if (!KIND.test(kind)) return res.status(404).json({ success: false, message: "Not found" });
  next();
});

router.get("/:kind/:id", admin, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await RemovalService.plan(req, req.params.kind, req.params.id) });
}));

router.post("/:kind/:id/deactivate", admin, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await RemovalService.deactivate(req, req.params.kind, req.params.id) });
}));

router.post("/:kind/:id/transfer", admin, asyncHandler(async (req, res) => {
  const body = transferSchema.parse(req.body || {});
  res.json({ success: true, data: await RemovalService.transfer(req, req.params.kind, req.params.id, { to: body.to || null, overrides: body.overrides || {} }) });
}));

router.delete("/:kind/:id", admin, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await RemovalService.remove(req, req.params.kind, req.params.id) });
}));

module.exports = router;
