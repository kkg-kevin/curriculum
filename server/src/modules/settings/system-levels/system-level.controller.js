const asyncHandler = require("express-async-handler");
const SystemLevelService = require("./system-level.service");
const {
  createSystemLevelSchema,
  updateSystemLevelSchema,
  reorderSystemLevelsSchema,
} = require("./system-level.validation");

exports.getSystemLevels = asyncHandler(async (req, res) => {
  const data = await SystemLevelService.getSystemLevels(req.ownerAdminId);
  res.json({ success: true, data });
});

exports.createSystemLevel = asyncHandler(async (req, res) => {
  const body = createSystemLevelSchema.parse(req.body);
  const data = await SystemLevelService.createSystemLevel({ ...body, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data });
});

exports.updateSystemLevel = asyncHandler(async (req, res) => {
  const body = updateSystemLevelSchema.parse(req.body);
  const data = await SystemLevelService.updateSystemLevel(req.params.lId, body, req.ownerAdminId);
  res.json({ success: true, data });
});

exports.deleteSystemLevel = asyncHandler(async (req, res) => {
  await SystemLevelService.deleteSystemLevel(req.params.lId, req.ownerAdminId);
  res.json({ success: true });
});

exports.reorderSystemLevels = asyncHandler(async (req, res) => {
  const { orderedIds } = reorderSystemLevelsSchema.parse(req.body);
  const data = await SystemLevelService.reorderSystemLevels(orderedIds, req.ownerAdminId);
  res.json({ success: true, data });
});
