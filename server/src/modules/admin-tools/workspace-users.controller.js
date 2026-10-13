const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const WorkspaceUsersService = require("./workspace-users.service");

const statusSchema = z.object({ active: z.boolean() });

// Mounted under admin-tools (authorize("admin") + blockIfCollaboratorRestricted at the app.js
// level), so only the workspace's own admin reaches these — same as the staff routes beside them.
const listUsers = asyncHandler(async (req, res) => {
  const data = await WorkspaceUsersService.list(req.ownerAdminId);
  res.json({ success: true, data });
});

const setUserStatus = asyncHandler(async (req, res) => {
  const { active } = statusSchema.parse(req.body);
  const data = await WorkspaceUsersService.setActive(req.ownerAdminId, req.params.id, active);
  res.json({ success: true, data });
});

module.exports = { listUsers, setUserStatus };
