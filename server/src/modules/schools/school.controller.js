const asyncHandler = require("express-async-handler");
const SchoolService = require("./school.service");
const { createSchoolSchema, updateSchoolSchema } = require("./school.validation");

const createSchool = asyncHandler(async (req, res) => {
  const data = createSchoolSchema.parse(req.body);
  const school = await SchoolService.createSchool(data);
  res.status(201).json({ success: true, data: school });
});

const getAllSchools = asyncHandler(async (req, res) => {
  const { status, county, curriculumId, email } = req.query;
  const schools = await SchoolService.getAllSchools({ status, county, curriculumId, email });
  res.json({ success: true, data: schools, count: schools.length });
});

const getSchoolById = asyncHandler(async (req, res) => {
  const school = await SchoolService.getSchoolById(req.params.id);
  res.json({ success: true, data: school });
});

const updateSchool = asyncHandler(async (req, res) => {
  const data = updateSchoolSchema.parse(req.body);
  const school = await SchoolService.updateSchool(req.params.id, data);
  res.json({ success: true, data: school });
});

const deleteSchool = asyncHandler(async (req, res) => {
  const result = await SchoolService.deleteSchool(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createSchool, getAllSchools, getSchoolById, updateSchool, deleteSchool };
