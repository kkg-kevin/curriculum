const asyncHandler = require("express-async-handler");
const CurriculumService = require("./curriculum.service");
const { createCurriculumSchema, updateCurriculumSchema } = require("./curriculum.validation");

const createCurriculum = asyncHandler(async (req, res) => {
  const data = createCurriculumSchema.parse(req.body);
  const curriculum = await CurriculumService.createCurriculum(data);
  res.status(201).json({ success: true, data: curriculum });
});

const getAllCurricula = asyncHandler(async (req, res) => {
  const { framework, academicYear } = req.query;
  const curricula = await CurriculumService.getAllCurricula({ framework, academicYear });
  res.json({ success: true, data: curricula, count: curricula.length });
});

const getCurriculumById = asyncHandler(async (req, res) => {
  const curriculum = await CurriculumService.getCurriculumById(req.params.id);
  res.json({ success: true, data: curriculum });
});

const updateCurriculum = asyncHandler(async (req, res) => {
  const data = updateCurriculumSchema.parse(req.body);
  const curriculum = await CurriculumService.updateCurriculum(req.params.id, data);
  res.json({ success: true, data: curriculum });
});

const deleteCurriculum = asyncHandler(async (req, res) => {
  const result = await CurriculumService.deleteCurriculum(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = {
  createCurriculum,
  getAllCurricula,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
};
