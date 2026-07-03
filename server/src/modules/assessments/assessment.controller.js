const asyncHandler = require("express-async-handler");
const AssessmentService = require("./assessment.service");
const {
  createAssessmentSchema,
  updateAssessmentSchema,
  createItemSchema,
  updateItemSchema,
  createRubricCriterionSchema,
  updateRubricCriterionSchema,
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

const addItem = asyncHandler(async (req, res) => {
  const data = createItemSchema.parse(req.body);
  const item = await AssessmentService.addItem(req.params.id, data);
  res.status(201).json({ success: true, data: item });
});

const updateItem = asyncHandler(async (req, res) => {
  const data = updateItemSchema.parse(req.body);
  const item = await AssessmentService.updateItem(req.params.id, req.params.itemId, data);
  res.json({ success: true, data: item });
});

const deleteItem = asyncHandler(async (req, res) => {
  const result = await AssessmentService.deleteItem(req.params.id, req.params.itemId);
  res.json({ success: true, ...result });
});

const addRubricCriterion = asyncHandler(async (req, res) => {
  const data = createRubricCriterionSchema.parse(req.body);
  const criterion = await AssessmentService.addRubricCriterion(req.params.id, data);
  res.status(201).json({ success: true, data: criterion });
});

const updateRubricCriterion = asyncHandler(async (req, res) => {
  const data = updateRubricCriterionSchema.parse(req.body);
  const criterion = await AssessmentService.updateRubricCriterion(req.params.id, req.params.criterionId, data);
  res.json({ success: true, data: criterion });
});

const deleteRubricCriterion = asyncHandler(async (req, res) => {
  const result = await AssessmentService.deleteRubricCriterion(req.params.id, req.params.criterionId);
  res.json({ success: true, ...result });
});

module.exports = {
  createAssessment,
  getAllAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  addItem,
  updateItem,
  deleteItem,
  addRubricCriterion,
  updateRubricCriterion,
  deleteRubricCriterion,
};
