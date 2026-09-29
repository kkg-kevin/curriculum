const asyncHandler = require("express-async-handler");
const AccessService = require("./access.service");

// Mounted owner-only (authorize("admin") + blockIfCollaboratorRestricted in app.js): staff can
// never see or change roles, including their own.

const listModules = asyncHandler(async (req, res) => {
  res.json({ success: true, data: AccessService.modules() });
});

const listRoles = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await AccessService.listRoles(req.ownerAdminId) });
});

const createRole = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await AccessService.createRole(req.ownerAdminId, req.body) });
});

const updateRole = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await AccessService.updateRole(req.ownerAdminId, req.params.id, req.body) });
});

const deleteRole = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await AccessService.deleteRole(req.ownerAdminId, req.params.id)) });
});

module.exports = { listModules, listRoles, createRole, updateRole, deleteRole };
