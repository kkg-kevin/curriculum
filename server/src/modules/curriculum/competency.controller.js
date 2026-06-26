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
  createAssessmentTypeSchema,
  updateAssessmentTypeSchema,
  updateScoringSchema,
  updateGlobalScoringSchema,
  createEvidenceTypeSchema,
  updateEvidenceTypeSchema,
  createPerformanceBandSchema,
  updatePerformanceBandSchema,
  reorderBandsSchema,
  calculateScoreSchema,
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

/* ── Assessment Types ────────────────────────────────────────────────────── */

exports.getAssessmentTypes = asyncHandler(async (req, res) => {
  const data = CompetencyService.getAssessmentTypes(req.params.id);
  res.json({ success: true, data });
});

exports.createAssessmentType = asyncHandler(async (req, res) => {
  const body = createAssessmentTypeSchema.parse(req.body);
  const data = CompetencyService.createAssessmentType(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateAssessmentType = asyncHandler(async (req, res) => {
  const body = updateAssessmentTypeSchema.parse(req.body);
  const data = CompetencyService.updateAssessmentType(req.params.id, req.params.atId, body);
  res.json({ success: true, data });
});

exports.deleteAssessmentType = asyncHandler(async (req, res) => {
  CompetencyService.deleteAssessmentType(req.params.id, req.params.atId);
  res.json({ success: true });
});

exports.updateScoring = asyncHandler(async (req, res) => {
  const { evidenceWeights } = updateScoringSchema.parse(req.body);
  const data = CompetencyService.updateScoring(req.params.id, req.params.atId, evidenceWeights);
  res.json({ success: true, data });
});

exports.calculateScore = asyncHandler(async (req, res) => {
  const { evidenceScores } = calculateScoreSchema.parse(req.body);
  const data = CompetencyService.calculateScore(req.params.id, req.params.atId, evidenceScores);
  res.json({ success: true, data });
});

exports.getCompetencyWeights = asyncHandler(async (req, res) => {
  const data = CompetencyService.getCompetencyWeights(req.params.id);
  res.json({ success: true, data });
});

exports.updateGlobalScoring = asyncHandler(async (req, res) => {
  const { assessmentTypes, competencyWeights } = updateGlobalScoringSchema.parse(req.body);
  const data = CompetencyService.updateGlobalScoring(req.params.id, assessmentTypes, competencyWeights);
  res.json({ success: true, data });
});

/* ── Evidence Types ──────────────────────────────────────────────────────── */

exports.getEvidenceTypes = asyncHandler(async (req, res) => {
  const data = CompetencyService.getEvidenceTypes(req.params.id);
  res.json({ success: true, data });
});

exports.createEvidenceType = asyncHandler(async (req, res) => {
  const body = createEvidenceTypeSchema.parse(req.body);
  const data = CompetencyService.createEvidenceType(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateEvidenceType = asyncHandler(async (req, res) => {
  const body = updateEvidenceTypeSchema.parse(req.body);
  const data = CompetencyService.updateEvidenceType(req.params.id, req.params.etId, body);
  res.json({ success: true, data });
});

exports.deleteEvidenceType = asyncHandler(async (req, res) => {
  CompetencyService.deleteEvidenceType(req.params.id, req.params.etId);
  res.json({ success: true });
});

/* ── Performance Bands ───────────────────────────────────────────────────── */

exports.getPerformanceBands = asyncHandler(async (req, res) => {
  const data = CompetencyService.getPerformanceBands(req.params.id);
  res.json({ success: true, data });
});

exports.createPerformanceBand = asyncHandler(async (req, res) => {
  const body = createPerformanceBandSchema.parse(req.body);
  const data = CompetencyService.createPerformanceBand(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updatePerformanceBand = asyncHandler(async (req, res) => {
  const body = updatePerformanceBandSchema.parse(req.body);
  const data = CompetencyService.updatePerformanceBand(req.params.id, req.params.bandId, body);
  res.json({ success: true, data });
});

exports.deletePerformanceBand = asyncHandler(async (req, res) => {
  CompetencyService.deletePerformanceBand(req.params.id, req.params.bandId);
  res.json({ success: true });
});

exports.reorderPerformanceBands = asyncHandler(async (req, res) => {
  const { orderedIds } = reorderBandsSchema.parse(req.body);
  const data = CompetencyService.reorderPerformanceBands(req.params.id, orderedIds);
  res.json({ success: true, data });
});
