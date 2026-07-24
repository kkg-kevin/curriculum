const asyncHandler = require("express-async-handler");
const ProgramService = require("./program.service");
const { createProgramSchema, updateProgramSchema } = require("./program.validation");

const createProgram = asyncHandler(async (req, res) => {
  const data = createProgramSchema.parse(req.body);
  const record = await ProgramService.createProgram(data);
  res.status(201).json({ success: true, data: record });
});

const getAllPrograms = asyncHandler(async (req, res) => {
  const { curriculumId } = req.query;
  const records = ProgramService.getAllPrograms({ curriculumId });
  res.json({ success: true, data: records, count: records.length });
});

const getProgramById = asyncHandler(async (req, res) => {
  const record = ProgramService.getProgramById(req.params.id);
  res.json({ success: true, data: record });
});

const updateProgram = asyncHandler(async (req, res) => {
  const data = updateProgramSchema.parse(req.body);
  const record = ProgramService.updateProgram(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteProgram = asyncHandler(async (req, res) => {
  const result = ProgramService.deleteProgram(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createProgram, getAllPrograms, getProgramById, updateProgram, deleteProgram };
