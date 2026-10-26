const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const WorkspaceUsersService = require("./workspace-users.service");

const statusSchema = z.object({ active: z.boolean() });

// Settings → Users. Mounted under admin-tools (authorize("admin") + blockIfCollaboratorRestricted
// at the app.js level), so only the workspace's own admin reaches these — same as the staff routes
// beside them. Everyone but parents and learners, who are the Learners module's (below).
const listUsers = asyncHandler(async (req, res) => {
  const data = await WorkspaceUsersService.list(req.ownerAdminId, req.user.id, { group: "others" });
  res.json({ success: true, data });
});

const setUserStatus = asyncHandler(async (req, res) => {
  const { active } = statusSchema.parse(req.body);
  const data = await WorkspaceUsersService.setActive(req.ownerAdminId, req.user.id, req.params.id, active, { group: "others" });
  res.json({ success: true, data });
});

// Learners → Parent & learner logins. Mounted in learner.routes.js (admin, and staff whose role
// covers Learners: viewing needs View, switching a login Edit — access.registry.js).
const listLearnerLogins = asyncHandler(async (req, res) => {
  const data = await WorkspaceUsersService.list(req.ownerAdminId, req.user.id, { group: "learners" });
  res.json({ success: true, data });
});

const setLearnerLoginStatus = asyncHandler(async (req, res) => {
  const { active } = statusSchema.parse(req.body);
  const data = await WorkspaceUsersService.setActive(req.ownerAdminId, req.user.id, req.params.id, active, { group: "learners" });
  res.json({ success: true, data });
});

module.exports = { listUsers, setUserStatus, listLearnerLogins, setLearnerLoginStatus };
