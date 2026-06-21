const asyncHandler = require("express-async-handler");
const SupplementaryService = require("./supplementary.service");
const {
  createSupplementarySchema,
  updateSupplementarySchema,
  updateGradesSchema,
  updateMappingSchema,
  updateAssignmentsSchema,
} = require("./supplementary.validation");

const createSupplementary = asyncHandler(async (req, res) => {
  const data = createSupplementarySchema.parse(req.body);
  const record = await SupplementaryService.create(data);
  res.status(201).json({ success: true, data: record });
});

const getAllSupplementary = asyncHandler(async (req, res) => {
  const { schoolId, type } = req.query;
  const records = await SupplementaryService.getAll({ schoolId, type });
  res.json({ success: true, data: records, count: records.length });
});

const getSupplementaryById = asyncHandler(async (req, res) => {
  const record = await SupplementaryService.getById(req.params.id);
  res.json({ success: true, data: record });
});

const updateSupplementary = asyncHandler(async (req, res) => {
  const data = updateSupplementarySchema.parse(req.body);
  const record = await SupplementaryService.update(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteSupplementary = asyncHandler(async (req, res) => {
  const result = await SupplementaryService.delete(req.params.id);
  res.json({ success: true, ...result });
});

const updateGrades = asyncHandler(async (req, res) => {
  const { grades } = updateGradesSchema.parse(req.body);
  const record = await SupplementaryService.updateGrades(req.params.id, grades);
  res.json({ success: true, data: record });
});

const updateMapping = asyncHandler(async (req, res) => {
  const { mapping } = updateMappingSchema.parse(req.body);
  const record = await SupplementaryService.updateMapping(req.params.id, mapping);
  res.json({ success: true, data: record });
});

const updateAssignments = asyncHandler(async (req, res) => {
  const { assignments } = updateAssignmentsSchema.parse(req.body);
  const record = await SupplementaryService.updateAssignments(req.params.id, assignments);
  res.json({ success: true, data: record });
});

module.exports = {
  createSupplementary,
  getAllSupplementary,
  getSupplementaryById,
  updateSupplementary,
  deleteSupplementary,
  updateGrades,
  updateMapping,
  updateAssignments,
};
