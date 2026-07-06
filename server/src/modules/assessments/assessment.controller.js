const asyncHandler = require("express-async-handler");
const AssessmentService = require("./assessment.service");
const {
  createAssessmentSchema,
  updateAssessmentSchema,
  linkCompetencySchema,
  linkLearningAreaSchema,
} = require("./assessment.validation");

const createAssessment = asyncHandler(async (req, res) => {
  const data = createAssessmentSchema.parse(req.body);
  const assessment = await AssessmentService.createAssessment(data);
  res.status(201).json({ success: true, data: assessment });
});

const getAllAssessments = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const assessments = await AssessmentService.getAllAssessments({ type });
  res.json({ success: true, data: assessments, count: assessments.length });
});

const getAssessmentById = asyncHandler(async (req, res) => {
  const assessment = await AssessmentService.getAssessmentById(req.params.id);
  res.json({ success: true, data: assessment });
});

const updateAssessment = asyncHandler(async (req, res) => {
  const data = updateAssessmentSchema.parse(req.body);
  const assessment = await AssessmentService.updateAssessment(req.params.id, data);
  res.json({ success: true, data: assessment });
});

const deleteAssessment = asyncHandler(async (req, res) => {
  const result = await AssessmentService.deleteAssessment(req.params.id);
  res.json({ success: true, ...result });
});

const getAssessmentCompetencies = asyncHandler(async (req, res) => {
  const data = await AssessmentService.getAssessmentCompetencies(req.params.id);
  res.json({ success: true, data });
});

const linkCompetency = asyncHandler(async (req, res) => {
  const { competencyId } = linkCompetencySchema.parse(req.body);
  const data = await AssessmentService.linkCompetency(req.params.id, competencyId);
  res.status(201).json({ success: true, data });
});

const unlinkCompetency = asyncHandler(async (req, res) => {
  const data = await AssessmentService.unlinkCompetency(req.params.id, req.params.competencyId);
  res.json({ success: true, data });
});

const getAssessmentLearningAreas = asyncHandler(async (req, res) => {
  const data = await AssessmentService.getAssessmentLearningAreas(req.params.id);
  res.json({ success: true, data });
});

const linkLearningArea = asyncHandler(async (req, res) => {
  const { learningAreaId } = linkLearningAreaSchema.parse(req.body);
  const data = await AssessmentService.linkLearningArea(req.params.id, learningAreaId);
  res.status(201).json({ success: true, data });
});

const unlinkLearningArea = asyncHandler(async (req, res) => {
  const data = await AssessmentService.unlinkLearningArea(req.params.id, req.params.learningAreaId);
  res.json({ success: true, data });
});

module.exports = {
  createAssessment,
  getAllAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  getAssessmentCompetencies,
  linkCompetency,
  unlinkCompetency,
  getAssessmentLearningAreas,
  linkLearningArea,
  unlinkLearningArea,
};
