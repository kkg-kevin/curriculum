const asyncHandler = require("express-async-handler");
const AcademicYearService = require("./academic-years.service");

// GET /api/curricula/:id/academic-years
const getAcademicYears = asyncHandler(async (req, res) => {
  const { id: curriculumId } = req.params;
  const data = AcademicYearService.getAll(curriculumId);
  res.json({ success: true, data });
});

// POST /api/curricula/:id/academic-years
const createGroup = asyncHandler(async (req, res) => {
  const { id: curriculumId } = req.params;
  const result = AcademicYearService.createGroup(curriculumId, req.body);
  res.status(201).json({ success: true, data: result });
});

// POST /api/curricula/:id/academic-years/:groupId/versions
const createVersion = asyncHandler(async (req, res) => {
  const { id: curriculumId, groupId } = req.params;
  const version = AcademicYearService.createVersion(curriculumId, groupId, req.body);
  res.status(201).json({ success: true, data: version });
});

// PATCH /api/curricula/:id/academic-years/:groupId/versions/:versionId/status
const changeStatus = asyncHandler(async (req, res) => {
  const { id: curriculumId, groupId, versionId } = req.params;
  const { status } = req.body;
  const version = AcademicYearService.changeStatus(curriculumId, groupId, versionId, status);
  res.json({ success: true, data: version });
});

module.exports = { getAcademicYears, createGroup, createVersion, changeStatus };
