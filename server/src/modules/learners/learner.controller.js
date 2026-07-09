const asyncHandler = require("express-async-handler");
const LearnerService = require("./learner.service");
const { createLearnerSchema, updateLearnerSchema } = require("./learner.validation");

const createLearner = asyncHandler(async (req, res) => {
  const data = createLearnerSchema.parse(req.body);
  const record = await LearnerService.createLearner(data);
  res.status(201).json({ success: true, data: record });
});

const getAllLearners = asyncHandler(async (req, res) => {
  const { schoolId, classId, status, guardianEmail } = req.query;
  const records = await LearnerService.getAllLearners({ schoolId, classId, status, guardianEmail });
  res.json({ success: true, data: records, count: records.length });
});

const getLearnerById = asyncHandler(async (req, res) => {
  const record = await LearnerService.getLearnerById(req.params.id);
  res.json({ success: true, data: record });
});

const updateLearner = asyncHandler(async (req, res) => {
  const data = updateLearnerSchema.parse(req.body);
  const record = await LearnerService.updateLearner(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteLearner = asyncHandler(async (req, res) => {
  const result = await LearnerService.deleteLearner(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createLearner, getAllLearners, getLearnerById, updateLearner, deleteLearner };
