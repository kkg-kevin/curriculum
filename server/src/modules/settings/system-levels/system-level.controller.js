const asyncHandler = require("express-async-handler");
const SystemLevelService = require("./system-level.service");
const {
  createSystemLevelSchema,
  updateSystemLevelSchema,
  reorderSystemLevelsSchema,
} = require("./system-level.validation");

exports.getSystemLevels = asyncHandler(async (req, res) => {
  const data = SystemLevelService.getSystemLevels();
  res.json({ success: true, data });
});

exports.createSystemLevel = asyncHandler(async (req, res) => {
  const body = createSystemLevelSchema.parse(req.body);
  const data = SystemLevelService.createSystemLevel(body);
  res.status(201).json({ success: true, data });
});

exports.updateSystemLevel = asyncHandler(async (req, res) => {
  const body = updateSystemLevelSchema.parse(req.body);
  const data = SystemLevelService.updateSystemLevel(req.params.lId, body);
  res.json({ success: true, data });
});

exports.deleteSystemLevel = asyncHandler(async (req, res) => {
  SystemLevelService.deleteSystemLevel(req.params.lId);
  res.json({ success: true });
});

exports.reorderSystemLevels = asyncHandler(async (req, res) => {
  const { orderedIds } = reorderSystemLevelsSchema.parse(req.body);
  const data = SystemLevelService.reorderSystemLevels(orderedIds);
  res.json({ success: true, data });
});
