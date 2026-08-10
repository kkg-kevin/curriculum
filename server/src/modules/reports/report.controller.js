const asyncHandler = require("express-async-handler");
const ReportService = require("./report.service");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const { generateReportSchema, updateRemarksSchema } = require("./report.validation");

// Same ownership shape as assessment-submission.controller.js's assertClassAccess — a report
// always has a classId (a course report only ever comes from a class enrollment), so a
// teacher/school can only reach reports for a class they have at least one course-educator
// link in / their own school.
async function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school")  assertOwn(cls.schoolId === req.ownSchool?.id);
  if (req.user.role === "teacher") {
    const links = await ClassCourseTeacherLinkModel.findByClassId(cls.id);
    assertOwn(links.some((l) => l.teacherId === req.ownTeacher?.id));
  }
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

// Accepts either one courseId (data = rows[]) or a comma-separated courseIds list
// (data = { [courseId]: rows[] }) — the batched form lets the teacher's Reports page paint every
// course in a class from a single request instead of one per class×course pair.
const getReadiness = asyncHandler(async (req, res) => {
  const { classId, courseId, courseIds } = req.query;
  if (!classId || (!courseId && !courseIds)) {
    const err = new Error("classId and either courseId or courseIds are required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);

  if (courseIds) {
    const ids = courseIds.split(",").map((s) => s.trim()).filter(Boolean);
    const byCourse = await ReportService.getReadinessForClassCourses(classId, ids);
    return res.json({ success: true, data: byCourse, count: ids.length });
  }

  const rows = await ReportService.getReadinessForClassCourse(classId, courseId);
  res.json({ success: true, data: rows, count: rows.length });
});

const generateReport = asyncHandler(async (req, res) => {
  const data = generateReportSchema.parse(req.body);
  const cls = await ClassModel.findById(data.classId);
  await assertClassAccess(req, cls);
  const report = await ReportService.generateReport({ ...data, generatedBy: req.ownTeacher?.id || req.user.id });
  res.status(201).json({ success: true, data: report });
});

const listReportsForClassCourse = asyncHandler(async (req, res) => {
  const { classId, courseId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const reports = await ReportService.listForClassCourse({ classId, courseId });
  res.json({ success: true, data: reports, count: reports.length });
});

const listReportsForLearner = asyncHandler(async (req, res) => {
  const learner = req.ownLearner;
  if (!learner) return res.json({ success: true, data: [] });
  // hubId comes from the portal's hub switcher — scopes the list to the hub being viewed.
  const reports = await ReportService.listForLearner(learner.id, req.query.hubId || null);
  res.json({ success: true, data: reports, count: reports.length });
});

const getReport = asyncHandler(async (req, res) => {
  const report = await ReportService.getById(req.params.id);
  if (!report) {
    const err = new Error("Report not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "learner") {
    assertLearnerOwnsReport(req, report);
  } else {
    const cls = await ClassModel.findById(report.classId);
    await assertClassAccess(req, cls);
  }
  res.json({ success: true, data: report });
});

// Shared by updateRemarks/publishReport — resolves the report and proves this caller owns the
// class it belongs to. Checks the report's own existence first so a bad id reports "Report not
// found" rather than falling through to assertClassAccess and blaming a missing class.
async function loadOwnedReportOrThrow(req) {
  const report = await ReportService.getById(req.params.id);
  if (!report) {
    const err = new Error("Report not found");
    err.statusCode = 404;
    throw err;
  }
  await assertClassAccess(req, await ClassModel.findById(report.classId));
  return report;
}

const updateRemarks = asyncHandler(async (req, res) => {
  await loadOwnedReportOrThrow(req);
  const { remarks } = updateRemarksSchema.parse(req.body);
  const updated = await ReportService.updateRemarks(req.params.id, remarks);
  res.json({ success: true, data: updated });
});

const publishReport = asyncHandler(async (req, res) => {
  await loadOwnedReportOrThrow(req);
  const updated = await ReportService.publishReport(req.params.id, req.ownTeacher?.id || req.user.id);
  res.json({ success: true, data: updated });
});

const unpublishReport = asyncHandler(async (req, res) => {
  await loadOwnedReportOrThrow(req);
  const updated = await ReportService.unpublishReport(req.params.id);
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
  unpublishReport,
};
