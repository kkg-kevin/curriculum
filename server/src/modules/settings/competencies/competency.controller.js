const asyncHandler      = require("express-async-handler");
const CompetencyService = require("./competency.service");
const {
  createCompetencySchema,
  updateCompetencySchema,
} = require("./competency.validation");
const { parsePatch } = require("../../../shared/validators/common.validator");
const UsageService = require("../../usage/usage.service");

/* ── Competencies ────────────────────────────────────────────────────────── */

exports.getCompetencies = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getCompetencies(req.ownerAdminId);
  res.json({ success: true, data });
});

exports.createCompetency = asyncHandler(async (req, res) => {
  const body = createCompetencySchema.parse(req.body);
  const data = await CompetencyService.createCompetency({ ...body, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data });
});

exports.updateCompetency = asyncHandler(async (req, res) => {
  // Only the fields that were sent — a partial update must not reset the others to their
  // defaults (see parsePatch).
  const body = parsePatch(updateCompetencySchema, req.body);
  const data = await CompetencyService.updateCompetency(req.params.cId, body, req.ownerAdminId);
  res.json({ success: true, data });
});

exports.deleteCompetency = asyncHandler(async (req, res) => {
  if (await UsageService.guardDelete(req, res, "competency", req.params.cId, "This competency")) return;
  await CompetencyService.deleteCompetency(req.params.cId, req.ownerAdminId);
  res.json({ success: true });
});
