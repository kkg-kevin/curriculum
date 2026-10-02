const asyncHandler      = require("express-async-handler");
const CompetencyService = require("./competency.service");
const {
  createCompetencySchema,
  updateCompetencySchema,
} = require("./competency.validation");
const { parsePatch } = require("../../../shared/validators/common.validator");

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
  await CompetencyService.deleteCompetency(req.params.cId, req.ownerAdminId);
  res.json({ success: true });
});
