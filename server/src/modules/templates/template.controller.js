const asyncHandler     = require("express-async-handler");
const TemplateService  = require("./template.service");
const {
  createTemplateSchema,
  updateTemplateSchema,
} = require("./template.validation");

exports.getTemplates = asyncHandler(async (req, res) => {
  const data = TemplateService.getTemplates(req.query.type);
  res.json({ success: true, data });
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const body = createTemplateSchema.parse(req.body);
  const data = TemplateService.createTemplate(body);
  res.status(201).json({ success: true, data });
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const body = updateTemplateSchema.parse(req.body);
  const data = TemplateService.updateTemplate(req.params.id, body);
  res.json({ success: true, data });
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  TemplateService.deleteTemplate(req.params.id);
  res.json({ success: true });
});
