const asyncHandler      = require("express-async-handler");
const CompetencyService = require("./competency.service");
const {
  createLearningAreaSchema,
  updateLearningAreaSchema,
  createCompetencySchema,
  updateCompetencySchema,
  updateLadderSchema,
  createAgeCategorySchema,
  updateAgeCategorySchema,
  createProgressLevelSchema,
  updateProgressLevelSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
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

/* ── Age Categories ──────────────────────────────────────────────────────── */

exports.getAgeCategories = asyncHandler(async (req, res) => {
  const data = CompetencyService.getAgeCategories(req.params.id);
  res.json({ success: true, data });
});

exports.createAgeCategory = asyncHandler(async (req, res) => {
  const body = createAgeCategorySchema.parse(req.body);
  const data = CompetencyService.createAgeCategory(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateAgeCategory = asyncHandler(async (req, res) => {
  const body = updateAgeCategorySchema.parse(req.body);
  const data = CompetencyService.updateAgeCategory(req.params.id, req.params.acId, body);
  res.json({ success: true, data });
});

exports.deleteAgeCategory = asyncHandler(async (req, res) => {
  CompetencyService.deleteAgeCategory(req.params.id, req.params.acId);
  res.json({ success: true });
});

/* ── Progress Levels ─────────────────────────────────────────────────────── */

exports.getProgressLevels = asyncHandler(async (req, res) => {
  const data = CompetencyService.getProgressLevels(req.params.id);
  res.json({ success: true, data });
});

exports.createProgressLevel = asyncHandler(async (req, res) => {
  const body = createProgressLevelSchema.parse(req.body);
  const data = CompetencyService.createProgressLevel(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateProgressLevel = asyncHandler(async (req, res) => {
  const body = updateProgressLevelSchema.parse(req.body);
  const data = CompetencyService.updateProgressLevel(req.params.id, req.params.plId, body);
  res.json({ success: true, data });
});

exports.deleteProgressLevel = asyncHandler(async (req, res) => {
  CompetencyService.deleteProgressLevel(req.params.id, req.params.plId);
  res.json({ success: true });
});

/* ── Assessments ─────────────────────────────────────────────────────────── */

exports.getAssessments = asyncHandler(async (req, res) => {
  const data = CompetencyService.getAssessments(req.params.id);
  res.json({ success: true, data });
});

exports.createAssessment = asyncHandler(async (req, res) => {
  const body = createAssessmentSchema.parse(req.body);
  const data = CompetencyService.createAssessment(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateAssessment = asyncHandler(async (req, res) => {
  const body = updateAssessmentSchema.parse(req.body);
  const data = CompetencyService.updateAssessment(req.params.id, req.params.asId, body);
  res.json({ success: true, data });
});

exports.deleteAssessment = asyncHandler(async (req, res) => {
  CompetencyService.deleteAssessment(req.params.id, req.params.asId);
  res.json({ success: true });
});
