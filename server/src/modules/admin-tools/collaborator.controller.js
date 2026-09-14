const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const CollaboratorService = require("./collaborator.service");

const inviteSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// This whole route is mounted under admin-tools (authorize("admin") + attachOwnRecords at the
// app.js level) and additionally refused outright for role "collaborator" by
// blockIfCollaboratorRestricted — a collaborator can edit the tenant's content but can never
// invite or remove another collaborator, so only the tenant's own admin ever reaches these.
const inviteCollaborator = asyncHandler(async (req, res) => {
  const data = inviteSchema.parse(req.body);
  const collaborator = await CollaboratorService.invite({ ...data, invitedByAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: collaborator });
});

const listCollaborators = asyncHandler(async (req, res) => {
  const collaborators = await CollaboratorService.listForAdmin(req.ownerAdminId);
  res.json({ success: true, data: collaborators, count: collaborators.length });
});

const revokeCollaborator = asyncHandler(async (req, res) => {
  const result = await CollaboratorService.revoke(req.params.id, req.ownerAdminId);
  res.json({ success: true, ...result });
});

module.exports = { inviteCollaborator, listCollaborators, revokeCollaborator };
