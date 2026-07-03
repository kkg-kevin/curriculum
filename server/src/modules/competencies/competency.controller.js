const asyncHandler      = require("express-async-handler");
const CompetencyService = require("./competency.service");
const {
  createCompetencySchema,
  updateCompetencySchema,
  createIndicatorSchema,
  updateIndicatorSchema,
} = require("./competency.validation");

/* ── Competencies ────────────────────────────────────────────────────────── */

exports.getCompetencies = asyncHandler(async (req, res) => {
  const data = CompetencyService.getCompetencies();
  res.json({ success: true, data });
});

exports.createCompetency = asyncHandler(async (req, res) => {
  const body = createCompetencySchema.parse(req.body);
  const data = CompetencyService.createCompetency(body);
  res.status(201).json({ success: true, data });
});

exports.updateCompetency = asyncHandler(async (req, res) => {
  const body = updateCompetencySchema.parse(req.body);
  const data = CompetencyService.updateCompetency(req.params.cId, body);
  res.json({ success: true, data });
});

exports.deleteCompetency = asyncHandler(async (req, res) => {
  CompetencyService.deleteCompetency(req.params.cId);
  res.json({ success: true });
});

/* ── Competency Indicators ───────────────────────────────────────────────── */

exports.getIndicators = asyncHandler(async (req, res) => {
  const data = CompetencyService.getIndicators(req.params.cId);
  res.json({ success: true, data });
});

exports.createIndicator = asyncHandler(async (req, res) => {
  const body = createIndicatorSchema.parse(req.body);
  const data = CompetencyService.createIndicator(req.params.cId, body);
  res.status(201).json({ success: true, data });
});

exports.updateIndicator = asyncHandler(async (req, res) => {
  const body = updateIndicatorSchema.parse(req.body);
  const data = CompetencyService.updateIndicator(req.params.cId, req.params.iId, body);
  res.json({ success: true, data });
});

exports.deleteIndicator = asyncHandler(async (req, res) => {
  CompetencyService.deleteIndicator(req.params.cId, req.params.iId);
  res.json({ success: true });
});
