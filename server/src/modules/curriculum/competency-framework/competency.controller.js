const asyncHandler      = require("express-async-handler");
const CompetencyService = require("./competency.service");
const {
  linkCompetencySchema,
  updateCompetencyLinkSchema,
  createIndicatorSchema,
  updateIndicatorSchema,
  createLearningAreaSchema,
  updateLearningAreaSchema,
  importLearningAreaSchema,
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
  calculateIndicatorProgressSchema,
  placeLearnerSchema,
} = require("./competency.validation");

// A `.partial()` schema still applies each field's own `.default(...)` when that field is
// entirely absent from the request body — so `schema.parse({})` on a partial schema comes
// back with every defaulted field filled in (e.g. `courses: []`), not left untouched. Since
// update handlers merge the parsed result over the existing record, that silently wipes
// every field the caller didn't intend to touch. This keeps only the keys the caller
// actually sent, so a genuinely partial PUT (e.g. just `{ courseSequence }`) can't erase
// anything else on the record.
function onlySentKeys(parsed, rawBody) {
  return Object.fromEntries(Object.keys(rawBody).map((k) => [k, parsed[k]]));
}

/* ── Curriculum ↔ Competency links ─────────────────────────────────────── */

exports.getCurriculumCompetencies = asyncHandler(async (req, res) => {
  const data = CompetencyService.getCurriculumCompetencies(req.params.id);
  res.json({ success: true, data });
});

exports.linkCompetency = asyncHandler(async (req, res) => {
  const { competencyId } = linkCompetencySchema.parse(req.body);
  const data = CompetencyService.linkCompetency(req.params.id, competencyId);
  res.status(201).json({ success: true, data });
});

exports.unlinkCompetency = asyncHandler(async (req, res) => {
  const data = CompetencyService.unlinkCompetency(req.params.id, req.params.competencyId);
  res.json({ success: true, data });
});

exports.updateCompetencyLink = asyncHandler(async (req, res) => {
  const body = updateCompetencyLinkSchema.parse(req.body);
  const data = CompetencyService.updateCompetencyLink(req.params.id, req.params.competencyId, body);
  res.json({ success: true, data });
});

/* ── Competency Indicators (curriculum-scoped) ─────────────────────────── */

exports.getCompetencyIndicators = asyncHandler(async (req, res) => {
  const data = CompetencyService.getCompetencyIndicators(req.params.id, req.params.competencyId);
  res.json({ success: true, data });
});

exports.createCompetencyIndicator = asyncHandler(async (req, res) => {
  const body = createIndicatorSchema.parse(req.body);
  const data = CompetencyService.createCompetencyIndicator(req.params.id, req.params.competencyId, body);
  res.status(201).json({ success: true, data });
});

exports.updateCompetencyIndicator = asyncHandler(async (req, res) => {
  const body = updateIndicatorSchema.parse(req.body);
  const data = CompetencyService.updateCompetencyIndicator(req.params.id, req.params.competencyId, req.params.indicatorId, body);
  res.json({ success: true, data });
});

exports.deleteCompetencyIndicator = asyncHandler(async (req, res) => {
  CompetencyService.deleteCompetencyIndicator(req.params.id, req.params.competencyId, req.params.indicatorId);
  res.json({ success: true });
});

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
  const body = onlySentKeys(updateLearningAreaSchema.parse(req.body), req.body);
  const data = CompetencyService.updateLearningArea(req.params.id, req.params.aId, body);
  res.json({ success: true, data });
});

exports.deleteLearningArea = asyncHandler(async (req, res) => {
  CompetencyService.deleteLearningArea(req.params.id, req.params.aId);
  res.json({ success: true });
});

exports.importLearningArea = asyncHandler(async (req, res) => {
  const { learningAreaId } = importLearningAreaSchema.parse(req.body);
  const data = CompetencyService.importLearningArea(req.params.id, learningAreaId);
  res.status(201).json({ success: true, data });
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
  const body = onlySentKeys(updateAgeCategorySchema.parse(req.body), req.body);
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
  const { evidenceScores, learnerId } = calculateScoreSchema.parse(req.body);
  const data = CompetencyService.calculateScore(req.params.id, req.params.atId, evidenceScores, learnerId);
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

exports.calculateIndicatorProgress = asyncHandler(async (req, res) => {
  const { indicatorAchievements } = calculateIndicatorProgressSchema.parse(req.body);
  const data = CompetencyService.calculateIndicatorProgress(req.params.id, indicatorAchievements);
  res.json({ success: true, data });
});

exports.getPopulatedIndicators = asyncHandler(async (req, res) => {
  const data = CompetencyService.getPopulatedIndicators(req.params.id);
  res.json({ success: true, data });
});

/* ── Learning Journey ────────────────────────────────────────────────────── */

exports.getLearningJourney = asyncHandler(async (req, res) => {
  const data = CompetencyService.getLearningJourney(req.params.id, req.params.learnerId);
  res.json({ success: true, data });
});

exports.placeLearner = asyncHandler(async (req, res) => {
  const body = placeLearnerSchema.parse(req.body);
  const data = CompetencyService.placeLearner(req.params.id, req.params.learnerId, req.params.areaId, body);
  res.status(201).json({ success: true, data });
});
