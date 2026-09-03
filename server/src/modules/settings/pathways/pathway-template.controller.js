const asyncHandler         = require("express-async-handler");
const PathwayTemplateService  = require("./pathway-template.service");
const {
  createPathwaySchema,
  updatePathwaySchema,
} = require("./pathway-template.validation");

exports.getPathways = asyncHandler(async (req, res) => {
  const data = await PathwayTemplateService.getPathways();
  res.json({ success: true, data });
});

exports.createPathway = asyncHandler(async (req, res) => {
  const body = createPathwaySchema.parse(req.body);
  const data = await PathwayTemplateService.createPathway(body);
  res.status(201).json({ success: true, data });
});

exports.updatePathway = asyncHandler(async (req, res) => {
  const body = updatePathwaySchema.parse(req.body);
  const data = await PathwayTemplateService.updatePathway(req.params.aId, body);
  res.json({ success: true, data });
});

exports.deletePathway = asyncHandler(async (req, res) => {
  await PathwayTemplateService.deletePathway(req.params.aId);
  res.json({ success: true });
});
