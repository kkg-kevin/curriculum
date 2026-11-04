const asyncHandler         = require("express-async-handler");
const PathwayTemplateService  = require("./pathway-template.service");
const {
  createPathwaySchema,
  updatePathwaySchema,
  setWebsiteSchema,
} = require("./pathway-template.validation");

exports.getPathways = asyncHandler(async (req, res) => {
  const data = await PathwayTemplateService.getPathways(req.ownerAdminId);
  res.json({ success: true, data });
});

// Settings → Pathways (read-only): the pathways the workspace's curricula use, and the unused ones.
exports.getDirectory = asyncHandler(async (req, res) => {
  const data = await PathwayTemplateService.getDirectory(req.ownerAdminId);
  res.json({ success: true, data });
});

// Settings → Pathways → Website: { visible, hubIds, image? }.
exports.setWebsite = asyncHandler(async (req, res) => {
  const body = setWebsiteSchema.parse(req.body);
  const data = await PathwayTemplateService.setWebsite(req.params.aId, body, req.ownerAdminId);
  res.json({ success: true, data });
});

exports.createPathway = asyncHandler(async (req, res) => {
  const body = createPathwaySchema.parse(req.body);
  const data = await PathwayTemplateService.createPathway({ ...body, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data });
});

exports.updatePathway = asyncHandler(async (req, res) => {
  const body = updatePathwaySchema.parse(req.body);
  const data = await PathwayTemplateService.updatePathway(req.params.aId, body, req.ownerAdminId);
  res.json({ success: true, data });
});

exports.deletePathway = asyncHandler(async (req, res) => {
  await PathwayTemplateService.deletePathway(req.params.aId, req.ownerAdminId);
  res.json({ success: true });
});
