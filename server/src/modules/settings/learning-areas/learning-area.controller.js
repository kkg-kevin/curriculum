const asyncHandler         = require("express-async-handler");
const LearningAreaService  = require("./learning-area.service");
const {
  createLearningAreaSchema,
  updateLearningAreaSchema,
} = require("./learning-area.validation");

exports.getLearningAreas = asyncHandler(async (req, res) => {
  const data = LearningAreaService.getLearningAreas();
  res.json({ success: true, data });
});

exports.createLearningArea = asyncHandler(async (req, res) => {
  const body = createLearningAreaSchema.parse(req.body);
  const data = LearningAreaService.createLearningArea(body);
  res.status(201).json({ success: true, data });
});

exports.updateLearningArea = asyncHandler(async (req, res) => {
  const body = updateLearningAreaSchema.parse(req.body);
  const data = LearningAreaService.updateLearningArea(req.params.aId, body);
  res.json({ success: true, data });
});

exports.deleteLearningArea = asyncHandler(async (req, res) => {
  LearningAreaService.deleteLearningArea(req.params.aId);
  res.json({ success: true });
});
