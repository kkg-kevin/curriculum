const asyncHandler = require("express-async-handler");
const ClassService = require("./class.service");
const { createClassSchema, updateClassSchema } = require("./class.validation");

const createClass = asyncHandler(async (req, res) => {
  const data = createClassSchema.parse(req.body);
  const record = await ClassService.createClass(data);
  res.status(201).json({ success: true, data: record });
});

const getAllClasses = asyncHandler(async (req, res) => {
  const { schoolId, status } = req.query;
  const records = await ClassService.getAllClasses({ schoolId, status });
  res.json({ success: true, data: records, count: records.length });
});

const getClassById = asyncHandler(async (req, res) => {
  const record = await ClassService.getClassById(req.params.id);
  res.json({ success: true, data: record });
});

const updateClass = asyncHandler(async (req, res) => {
  const data = updateClassSchema.parse(req.body);
  const record = await ClassService.updateClass(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteClass = asyncHandler(async (req, res) => {
  const result = await ClassService.deleteClass(req.params.id);
  res.json({ success: true, ...result });
});

const bulkCreateClasses = asyncHandler(async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Expected a non-empty array" });
  }
  const parsed = items.map((item) => createClassSchema.parse(item));
  const records = await ClassService.bulkCreateClasses(parsed);
  res.status(201).json({ success: true, data: records, count: records.length });
});

module.exports = { createClass, getAllClasses, getClassById, updateClass, deleteClass, bulkCreateClasses };
