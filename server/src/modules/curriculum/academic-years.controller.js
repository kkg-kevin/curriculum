const asyncHandler = require("express-async-handler");
const AcademicYearService = require("./academic-years.service");

const getAcademicYears = asyncHandler(async (req, res) => {
  const { id: curriculumId } = req.params;
  const all = AcademicYearService.getAllForCurriculum(curriculumId);
  const current = all.find((y) => y.isCurrent) || null;
  const history = all.filter((y) => !y.isCurrent);
  res.json({ success: true, data: { current, history } });
});

const createAcademicYear = asyncHandler(async (req, res) => {
  const { id: curriculumId } = req.params;
  const { isFresh, ...data } = req.body;
  const year = AcademicYearService.create(curriculumId, data, !!isFresh);
  res.status(201).json({ success: true, data: year });
});

const editAcademicYear = asyncHandler(async (req, res) => {
  const { id: curriculumId, yearId } = req.params;
  const year = AcademicYearService.edit(curriculumId, yearId, req.body);
  res.json({ success: true, data: year });
});

const changeStatus = asyncHandler(async (req, res) => {
  const { id: curriculumId, yearId } = req.params;
  const { status } = req.body;
  const year = AcademicYearService.changeStatus(curriculumId, yearId, status);
  res.json({ success: true, data: year });
});

module.exports = { getAcademicYears, createAcademicYear, editAcademicYear, changeStatus };
