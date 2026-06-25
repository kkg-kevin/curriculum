const asyncHandler      = require("express-async-handler");
const CompetencyService = require("./competency.service");
const {
  createLearningAreaSchema,
  updateLearningAreaSchema,
  createCompetencySchema,
  updateCompetencySchema,
  updateLadderSchema,
} = require("./competency.validation");

/* ── Learning Areas ──────────────────────────────────────────────────────── */

exports.getLearningAreas = asyncHandler(async (req, res) => {
  const data = CompetencyService.getLearningAreas(req.params.id);
  res.json({ success: true, data });
});

exports.createLearningArea = asyncHandler(async (req, res) => {
  const body = createLearningAreaSchema.parse(req.body);
  const data = CompetencyService.createLearningArea(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateLearningArea = asyncHandler(async (req, res) => {
  const body = updateLearningAreaSchema.parse(req.body);
  const data = CompetencyService.updateLearningArea(req.params.id, req.params.aId, body);
  res.json({ success: true, data });
});

exports.deleteLearningArea = asyncHandler(async (req, res) => {
  CompetencyService.deleteLearningArea(req.params.id, req.params.aId);
  res.json({ success: true });
});

/* ── Competencies ────────────────────────────────────────────────────────── */

exports.getCompetencies = asyncHandler(async (req, res) => {
  const data = CompetencyService.getCompetencies(req.params.id);
  res.json({ success: true, data });
});

exports.createCompetency = asyncHandler(async (req, res) => {
  const body = createCompetencySchema.parse(req.body);
  const data = CompetencyService.createCompetency(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateCompetency = asyncHandler(async (req, res) => {
  const body = updateCompetencySchema.parse(req.body);
  const data = CompetencyService.updateCompetency(req.params.id, req.params.cId, body);
  res.json({ success: true, data });
});

exports.deleteCompetency = asyncHandler(async (req, res) => {
  CompetencyService.deleteCompetency(req.params.id, req.params.cId);
  res.json({ success: true });
});

/* ── Progression Ladder ──────────────────────────────────────────────────── */

exports.getLadder = asyncHandler(async (req, res) => {
  const data = CompetencyService.getLadder(req.params.id);
  res.json({ success: true, data });
});

exports.updateLadder = asyncHandler(async (req, res) => {
  const { rungs } = updateLadderSchema.parse(req.body);
  const data      = CompetencyService.updateLadder(req.params.id, rungs);
  res.json({ success: true, data });
});
