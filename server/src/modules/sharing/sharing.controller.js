const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const SharingService = require("./sharing.service");

// Mounted owner-only (authorize("admin") + blockIfCollaboratorRestricted in app.js): sharing a
// workspace's content with another admin is the owner's decision, never a staff member's.

const requestSchema = z.object({ email: z.string().email("Enter a valid email address") });
const copySchema = z.object({ kind: z.string().min(1), ids: z.array(z.string().min(1)).min(1, "Choose at least one to add").max(200) });

const listKinds = asyncHandler(async (req, res) => {
  res.json({ success: true, data: SharingService.kinds() });
});

const listConnections = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await SharingService.listConnections(req.ownerAdminId) });
});

const requestConnection = asyncHandler(async (req, res) => {
  const { email } = requestSchema.parse(req.body);
  res.status(201).json({ success: true, data: await SharingService.requestConnection(req.ownerAdminId, email) });
});

const acceptConnection = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await SharingService.acceptConnection(req.ownerAdminId, req.params.id) });
});

const removeConnection = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await SharingService.removeConnection(req.ownerAdminId, req.params.id)) });
});

const browse = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await SharingService.browse(req.ownerAdminId, req.params.id, req.params.kind) });
});

const copy = asyncHandler(async (req, res) => {
  const { kind, ids } = copySchema.parse(req.body);
  res.status(201).json({ success: true, data: await SharingService.copy(req.ownerAdminId, req.params.id, kind, ids) });
});

module.exports = { listKinds, listConnections, requestConnection, acceptConnection, removeConnection, browse, copy };
