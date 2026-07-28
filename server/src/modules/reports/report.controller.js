const asyncHandler = require("express-async-handler");
const ReportService = require("./report.service");
const ClassModel = require("../classes/class.model");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const { generateReportSchema, updateRemarksSchema } = require("./report.validation");

// Same ownership shape as assessment-submission.controller.js's assertClassAccess — a report
// always has a classId (a course report only ever comes from a class enrollment), so a
// teacher/school can only reach reports for their own class.
function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school")  assertOwn(cls.schoolId === req.ownSchool?.id);
  if (req.user.role === "teacher") assertOwn(cls.classTeacherId === req.ownTeacher?.id);
}

function assertLearnerOwnsReport(req, report) {
  if (!report) {
    const err = new Error("Report not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "learner") {
    assertOwn(report.learnerId === req.ownLearner?.id);
    // A learner/guardian can only ever see a report the teacher has actually published — a
    // draft is still under review and shouldn't leak preliminary scores.
    assertOwn(report.status === "published");
  }
}

const getReadiness = asyncHandler(async (req, res) => {
  const { classId, courseId } = req.query;
  if (!classId || !courseId) {
    const err = new Error("classId and courseId are required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const rows = ReportService.getReadinessForClassCourse(classId, courseId);
  res.json({ success: true, data: rows, count: rows.length });
});

const generateReport = asyncHandler(async (req, res) => {
  const data = generateReportSchema.parse(req.body);
  const cls = ClassModel.findById(data.classId);
  assertClassAccess(req, cls);
  const report = ReportService.generateReport({ ...data, generatedBy: req.ownTeacher?.id || req.user.id });
  res.status(201).json({ success: true, data: report });
});

const listReportsForClassCourse = asyncHandler(async (req, res) => {
  const { classId, courseId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const reports = ReportService.listForClassCourse({ classId, courseId });
  res.json({ success: true, data: reports, count: reports.length });
});

const listReportsForLearner = asyncHandler(async (req, res) => {
  const learner = req.ownLearner;
  if (!learner) return res.json({ success: true, data: [] });
  const reports = ReportService.listForLearner(learner.id);
  res.json({ success: true, data: reports, count: reports.length });
});

const getReport = asyncHandler(async (req, res) => {
  const report = ReportService.getById(req.params.id);
  if (!report) {
    const err = new Error("Report not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "learner") {
    assertLearnerOwnsReport(req, report);
  } else {
    const cls = ClassModel.findById(report.classId);
    assertClassAccess(req, cls);
  }
  res.json({ success: true, data: report });
});

const updateRemarks = asyncHandler(async (req, res) => {
  const report = ReportService.getById(req.params.id);
  const cls = ClassModel.findById(report?.classId);
  assertClassAccess(req, cls);
  const { remarks } = updateRemarksSchema.parse(req.body);
  const updated = ReportService.updateRemarks(req.params.id, remarks);
  res.json({ success: true, data: updated });
});

const publishReport = asyncHandler(async (req, res) => {
  const report = ReportService.getById(req.params.id);
  const cls = ClassModel.findById(report?.classId);
  assertClassAccess(req, cls);
  const updated = ReportService.publishReport(req.params.id, req.ownTeacher?.id || req.user.id);
  res.json({ success: true, data: updated });
});

module.exports = {
  getReadiness,
  generateReport,
  listReportsForClassCourse,
  listReportsForLearner,
  getReport,
  updateRemarks,
  publishReport,
};
