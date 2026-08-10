const asyncHandler      = require("express-async-handler");
const CompetencyService = require("./competency.service");
const {
  createCompetencySchema,
  updateCompetencySchema,
} = require("./competency.validation");

/* ── Competencies ────────────────────────────────────────────────────────── */

exports.getCompetencies = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getCompetencies();
  res.json({ success: true, data });
});

exports.createCompetency = asyncHandler(async (req, res) => {
  const body = createCompetencySchema.parse(req.body);
  const data = await CompetencyService.createCompetency(body);
  res.status(201).json({ success: true, data });
});

exports.updateCompetency = asyncHandler(async (req, res) => {
  const body = updateCompetencySchema.parse(req.body);
  const data = await CompetencyService.updateCompetency(req.params.cId, body);
  res.json({ success: true, data });
});

exports.deleteCompetency = asyncHandler(async (req, res) => {
  await CompetencyService.deleteCompetency(req.params.cId);
  res.json({ success: true });
});
