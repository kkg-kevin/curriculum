const asyncHandler = require("express-async-handler");
const AssessmentService = require("./assessment.service");
const { createAssessmentSchema, updateAssessmentSchema } = require("./assessment.validation");

const createAssessment = asyncHandler(async (req, res) => {
  const data = createAssessmentSchema.parse(req.body);
  const assessment = await AssessmentService.createAssessment(data);
  res.status(201).json({ success: true, data: assessment });
});

const getAllAssessments = asyncHandler(async (req, res) => {
  const { status, type } = req.query;
  const assessments = await AssessmentService.getAllAssessments({ status, type });
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

module.exports = { createAssessment, getAllAssessments, getAssessmentById, updateAssessment, deleteAssessment };
