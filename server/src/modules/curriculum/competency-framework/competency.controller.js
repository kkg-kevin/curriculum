const asyncHandler      = require("express-async-handler");
const CompetencyService = require("./competency.service");
const LearnerHubLinkModel = require("../../learners/learner-hub-link.model");
const { assertOwn, isOwnHub } = require("../../../shared/middleware/scope.middleware");
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
  setIndicatorAchievementSchema,
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
  const data = await CompetencyService.getCurriculumCompetencies(req.params.id);
  res.json({ success: true, data });
});

exports.linkCompetency = asyncHandler(async (req, res) => {
  const { competencyId } = linkCompetencySchema.parse(req.body);
  const data = await CompetencyService.linkCompetency(req.params.id, competencyId);
  res.status(201).json({ success: true, data });
});

exports.unlinkCompetency = asyncHandler(async (req, res) => {
  const data = await CompetencyService.unlinkCompetency(req.params.id, req.params.competencyId);
  res.json({ success: true, data });
});

exports.updateCompetencyLink = asyncHandler(async (req, res) => {
  const body = updateCompetencyLinkSchema.parse(req.body);
  const data = await CompetencyService.updateCompetencyLink(req.params.id, req.params.competencyId, body);
  res.json({ success: true, data });
});

/* ── Competency Indicators (curriculum-scoped) ─────────────────────────── */

exports.getCompetencyIndicators = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getCompetencyIndicators(req.params.id, req.params.competencyId);
  res.json({ success: true, data });
});

exports.createCompetencyIndicator = asyncHandler(async (req, res) => {
  const body = createIndicatorSchema.parse(req.body);
  const data = await CompetencyService.createCompetencyIndicator(req.params.id, req.params.competencyId, body);
  res.status(201).json({ success: true, data });
});

exports.updateCompetencyIndicator = asyncHandler(async (req, res) => {
  const body = updateIndicatorSchema.parse(req.body);
  const data = await CompetencyService.updateCompetencyIndicator(req.params.id, req.params.competencyId, req.params.indicatorId, body);
  res.json({ success: true, data });
});

exports.deleteCompetencyIndicator = asyncHandler(async (req, res) => {
  await CompetencyService.deleteCompetencyIndicator(req.params.id, req.params.competencyId, req.params.indicatorId);
  res.json({ success: true });
});

/* ── Learning Areas ──────────────────────────────────────────────────────── */

exports.getLearningAreas = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getLearningAreas(req.params.id);
  res.json({ success: true, data });
});

exports.createLearningArea = asyncHandler(async (req, res) => {
  const body = createLearningAreaSchema.parse(req.body);
  const data = await CompetencyService.createLearningArea(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateLearningArea = asyncHandler(async (req, res) => {
  const body = onlySentKeys(updateLearningAreaSchema.parse(req.body), req.body);
  const data = await CompetencyService.updateLearningArea(req.params.id, req.params.aId, body);
  res.json({ success: true, data });
});

exports.deleteLearningArea = asyncHandler(async (req, res) => {
  await CompetencyService.deleteLearningArea(req.params.id, req.params.aId);
  res.json({ success: true });
});

exports.importLearningArea = asyncHandler(async (req, res) => {
  const { learningAreaId } = importLearningAreaSchema.parse(req.body);
  const data = await CompetencyService.importLearningArea(req.params.id, learningAreaId);
  res.status(201).json({ success: true, data });
});

/* ── Progression Ladder ──────────────────────────────────────────────────── */

exports.getLadder = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getLadder(req.params.id);
  res.json({ success: true, data });
});

exports.updateLadder = asyncHandler(async (req, res) => {
  const { rungs } = updateLadderSchema.parse(req.body);
  const data      = await CompetencyService.updateLadder(req.params.id, rungs);
  res.json({ success: true, data });
});

/* ── Age Categories ──────────────────────────────────────────────────────── */

exports.getAgeCategories = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getAgeCategories(req.params.id);
  res.json({ success: true, data });
});

exports.createAgeCategory = asyncHandler(async (req, res) => {
  const body = createAgeCategorySchema.parse(req.body);
  const data = await CompetencyService.createAgeCategory(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateAgeCategory = asyncHandler(async (req, res) => {
  const body = onlySentKeys(updateAgeCategorySchema.parse(req.body), req.body);
  const data = await CompetencyService.updateAgeCategory(req.params.id, req.params.acId, body);
  res.json({ success: true, data });
});

exports.deleteAgeCategory = asyncHandler(async (req, res) => {
  await CompetencyService.deleteAgeCategory(req.params.id, req.params.acId);
  res.json({ success: true });
});

/* ── Progress Levels ─────────────────────────────────────────────────────── */

exports.getProgressLevels = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getProgressLevels(req.params.id);
  res.json({ success: true, data });
});

exports.createProgressLevel = asyncHandler(async (req, res) => {
  const body = createProgressLevelSchema.parse(req.body);
  const data = await CompetencyService.createProgressLevel(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateProgressLevel = asyncHandler(async (req, res) => {
  const body = updateProgressLevelSchema.parse(req.body);
  const data = await CompetencyService.updateProgressLevel(req.params.id, req.params.plId, body);
  res.json({ success: true, data });
});

exports.deleteProgressLevel = asyncHandler(async (req, res) => {
  await CompetencyService.deleteProgressLevel(req.params.id, req.params.plId);
  res.json({ success: true });
});

/* ── Assessment Types ────────────────────────────────────────────────────── */

exports.getAssessmentTypes = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getAssessmentTypes(req.params.id);
  res.json({ success: true, data });
});

exports.createAssessmentType = asyncHandler(async (req, res) => {
  const body = createAssessmentTypeSchema.parse(req.body);
  const data = await CompetencyService.createAssessmentType(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateAssessmentType = asyncHandler(async (req, res) => {
  const body = updateAssessmentTypeSchema.parse(req.body);
  const data = await CompetencyService.updateAssessmentType(req.params.id, req.params.atId, body);
  res.json({ success: true, data });
});

exports.deleteAssessmentType = asyncHandler(async (req, res) => {
  await CompetencyService.deleteAssessmentType(req.params.id, req.params.atId);
  res.json({ success: true });
});

exports.updateScoring = asyncHandler(async (req, res) => {
  const { evidenceWeights } = updateScoringSchema.parse(req.body);
  const data = await CompetencyService.updateScoring(req.params.id, req.params.atId, evidenceWeights);
  res.json({ success: true, data });
});

exports.calculateScore = asyncHandler(async (req, res) => {
  const { evidenceScores, ageCategoryId } = calculateScoreSchema.parse(req.body);
  const data = await CompetencyService.calculateScore(req.params.id, req.params.atId, evidenceScores, ageCategoryId);
  res.json({ success: true, data });
});

exports.getCompetencyWeights = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getCompetencyWeights(req.params.id);
  res.json({ success: true, data });
});

exports.updateGlobalScoring = asyncHandler(async (req, res) => {
  const { assessmentTypes, competencyWeights } = updateGlobalScoringSchema.parse(req.body);
  const data = await CompetencyService.updateGlobalScoring(req.params.id, assessmentTypes, competencyWeights);
  res.json({ success: true, data });
});

/* ── Evidence Types ──────────────────────────────────────────────────────── */

exports.getEvidenceTypes = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getEvidenceTypes(req.params.id);
  res.json({ success: true, data });
});

exports.createEvidenceType = asyncHandler(async (req, res) => {
  const body = createEvidenceTypeSchema.parse(req.body);
  const data = await CompetencyService.createEvidenceType(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updateEvidenceType = asyncHandler(async (req, res) => {
  const body = updateEvidenceTypeSchema.parse(req.body);
  const data = await CompetencyService.updateEvidenceType(req.params.id, req.params.etId, body);
  res.json({ success: true, data });
});

exports.deleteEvidenceType = asyncHandler(async (req, res) => {
  await CompetencyService.deleteEvidenceType(req.params.id, req.params.etId);
  res.json({ success: true });
});

/* ── Performance Bands ───────────────────────────────────────────────────── */

exports.getPerformanceBands = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getPerformanceBands(req.params.id);
  res.json({ success: true, data });
});

exports.createPerformanceBand = asyncHandler(async (req, res) => {
  const body = createPerformanceBandSchema.parse(req.body);
  const data = await CompetencyService.createPerformanceBand(req.params.id, body);
  res.status(201).json({ success: true, data });
});

exports.updatePerformanceBand = asyncHandler(async (req, res) => {
  const body = updatePerformanceBandSchema.parse(req.body);
  const data = await CompetencyService.updatePerformanceBand(req.params.id, req.params.bandId, body);
  res.json({ success: true, data });
});

exports.deletePerformanceBand = asyncHandler(async (req, res) => {
  await CompetencyService.deletePerformanceBand(req.params.id, req.params.bandId);
  res.json({ success: true });
});

exports.reorderPerformanceBands = asyncHandler(async (req, res) => {
  const { ageCategoryId, orderedIds } = reorderBandsSchema.parse(req.body);
  const data = await CompetencyService.reorderPerformanceBands(req.params.id, ageCategoryId, orderedIds);
  res.json({ success: true, data });
});

exports.duplicatePerformanceBandToNext = asyncHandler(async (req, res) => {
  const data = await CompetencyService.duplicatePerformanceBandToNext(req.params.id, req.params.bandId);
  res.json({ success: true, data });
});

exports.calculateIndicatorProgress = asyncHandler(async (req, res) => {
  const { ageCategoryId, indicatorAchievements } = calculateIndicatorProgressSchema.parse(req.body);
  const data = await CompetencyService.calculateIndicatorProgress(req.params.id, ageCategoryId, indicatorAchievements);
  res.json({ success: true, data });
});

exports.getPopulatedIndicators = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getPopulatedIndicators(req.params.id);
  res.json({ success: true, data });
});

exports.getIndicatorAchievements = asyncHandler(async (req, res) => {
  const data = await CompetencyService.getIndicatorAchievements(req.params.id);
  res.json({ success: true, data });
});

exports.setIndicatorAchievement = asyncHandler(async (req, res) => {
  const { competencyId, marksEarned } = setIndicatorAchievementSchema.parse(req.body);
  const data = await CompetencyService.setIndicatorAchievement(req.params.id, req.params.indicatorId, competencyId, marksEarned);
  res.json({ success: true, data });
});

// Curriculum-wide preview — averaged across every learner who actually has graded work against
// this curriculum (see getCurriculumWideCompetencyScores), not the old manual IndicatorAchievement
// entry that no admin UI ever populated.
exports.getCompetencyScores = asyncHandler(async (req, res) => {
  const ageCategoryId = req.query.ageCategoryId;
  if (!ageCategoryId) {
    const err = new Error("ageCategoryId is required");
    err.statusCode = 400;
    throw err;
  }
  const data = await CompetencyService.getCurriculumWideCompetencyScores(req.params.id, ageCategoryId);
  res.json({ success: true, data });
});

exports.getBandProgress = asyncHandler(async (req, res) => {
  const ageCategoryId = req.query.ageCategoryId;
  if (!ageCategoryId) {
    const err = new Error("ageCategoryId is required");
    err.statusCode = 400;
    throw err;
  }
  const data = await CompetencyService.getCurriculumWideBandProgress(req.params.id, ageCategoryId);
  res.json({ success: true, data });
});

// A learner reading their own real competency scores/band-progress, or an admin/school
// reviewing it for a learner in their own hub — same ownership shape as
// assessment-submission.controller.js's getLearnerIndicatorProgress (this is the same live
// data, just run through the curriculum's own Evidence/Assessment-Type scoring config on top).
async function assertLearnerHubAccess(req, learnerId) {
  if (req.user.role === "school") {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const hubIds = links.map((l) => l.hubId);
    assertOwn(hubIds.some((hubId) => isOwnHub(req, hubId)));
  } else if (req.user.role === "teacher") {
    assertOwn(false);
  }
}

exports.getLearnerCompetencyScores = asyncHandler(async (req, res) => {
  const learnerId = req.params.learnerId;
  if (req.user.role === "learner") {
    assertOwn(learnerId === req.ownLearner?.id);
  } else {
    await assertLearnerHubAccess(req, learnerId);
  }
  const data = await CompetencyService.getLearnerCompetencyScores(req.params.id, learnerId);
  res.json({ success: true, data });
});

exports.getLearnerBandProgress = asyncHandler(async (req, res) => {
  const learnerId = req.params.learnerId;
  if (req.user.role === "learner") {
    assertOwn(learnerId === req.ownLearner?.id);
  } else {
    await assertLearnerHubAccess(req, learnerId);
  }
  const data = await CompetencyService.getLearnerBandProgress(req.params.id, learnerId);
  res.json({ success: true, data });
});

/* ── Learning Journey ────────────────────────────────────────────────────── */

exports.getLearningJourney = asyncHandler(async (req, res) => {
  const learnerId = req.params.learnerId;
  if (req.user.role === "learner") {
    assertOwn(learnerId === req.ownLearner?.id);
  } else {
    await assertLearnerHubAccess(req, learnerId);
  }
  const data = await CompetencyService.getLearningJourney(req.params.id, learnerId);
  res.json({ success: true, data });
});

exports.placeLearner = asyncHandler(async (req, res) => {
  const body = placeLearnerSchema.parse(req.body);
  const data = await CompetencyService.placeLearner(req.params.id, req.params.learnerId, req.params.areaId, body);
  res.status(201).json({ success: true, data });
});
