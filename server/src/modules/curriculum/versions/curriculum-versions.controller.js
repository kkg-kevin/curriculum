const asyncHandler = require("express-async-handler");
const CurriculumVersionService = require("./curriculum-versions.service");
const CurriculumModel = require("../curriculum.model");

const getVersions = asyncHandler(async (req, res) => {
  const result = await CurriculumVersionService.getAllForCurriculum(req.params.id);
  res.json({ success: true, data: result });
});

const createVersion = asyncHandler(async (req, res) => {
  const curriculum = await CurriculumModel.findById(req.params.id);
  if (!curriculum) return res.status(404).json({ success: false, message: "Curriculum not found" });
  const version = await CurriculumVersionService.create(req.params.id, curriculum, req.body);
  res.status(201).json({ success: true, data: version });
});

const editVersion = asyncHandler(async (req, res) => {
  const version = await CurriculumVersionService.edit(req.params.id, req.params.vId, req.body);
  res.json({ success: true, data: version });
});

const changeVersionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const version = await CurriculumVersionService.changeStatus(req.params.id, req.params.vId, status);
  res.json({ success: true, data: version });
});

const getCurrentCourses = asyncHandler(async (req, res) => {
  const courses = await CurriculumVersionService.getCurrentCourses(req.params.id, req.query.gradeId || null);
  res.json({ success: true, data: courses });
});

module.exports = { getVersions, createVersion, editVersion, changeVersionStatus, getCurrentCourses };
