const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const ReassignOwnerService = require("./reassign-owner.service");

const reassignSchema = z.object({
  entityType: z.enum(["hub", "curriculum", "course", "assessment"]),
  entityId: z.string().min(1),
  targetAdminEmail: z.string().email(),
});

// Admin-only, and only ever operates on entities the CALLING admin currently owns (see
// reassign() requiring currentOwnerAdminId to match) — one admin can give away something of
// theirs, but can't reach in and move another admin's data around. Mounted under this same
// req.ownerAdminId-attached router in reassign-owner.routes.js.
const reassignOwner = asyncHandler(async (req, res) => {
  const { entityType, entityId, targetAdminEmail } = reassignSchema.parse(req.body);
  const result = await ReassignOwnerService.reassign({
    entityType,
    entityId,
    targetAdminEmail,
    currentOwnerAdminId: req.ownerAdminId,
  });
  res.json({ success: true, data: result });
});

module.exports = { reassignOwner };
