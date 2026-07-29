const asyncHandler = require("express-async-handler");
const ClassService = require("./class.service");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const ClassCourseTeacherLinkModel = require("./class-course-teacher-link.model");
const TeacherModel = require("../teachers/teacher.model");
const { createClassSchema, updateClassSchema } = require("./class.validation");
const { assertOwn, isOwnHub } = require("../../shared/middleware/scope.middleware");

// updateClassSchema is createClassSchema.partial(), but zod still materializes a field's
// .default(...) when its key is simply absent from the request body — e.g. a partial update
// that only sends { classTeacherId } comes back from .parse() with capacity: null and
// status: "active", silently wiping whatever those fields actually held. Recursively keep
// only keys actually present in the raw body so a genuinely partial update never overwrites a
// field the caller didn't send (same fix as learning-hub.controller.js's pickPresent).
function pickPresent(parsed, raw) {
  if (raw === null || typeof raw !== "object") return parsed;
  const result = {};
  for (const key of Object.keys(raw)) {
    if (parsed[key] === undefined) continue;
    result[key] = (typeof parsed[key] === "object" && parsed[key] !== null && !Array.isArray(parsed[key]))
      ? pickPresent(parsed[key], raw[key])
      : parsed[key];
  }
  return result;
}

const createClass = asyncHandler(async (req, res) => {
  const data = createClassSchema.parse(req.body);
  if (req.user.role === "school") {
    assertOwn(!!req.ownSchool);
    data.schoolId = req.ownSchool.id;
  } else if (req.user.role === "branchAdmin") {
    assertOwn(isOwnHub(req, data.schoolId));
  }
  const record = await ClassService.createClass(data);
  res.status(201).json({ success: true, data: record });
});

// A teacher's "my classes" is now every class with at least one course-educator link naming
// them — there's no more single classTeacherId to filter by directly, so this resolves the
// matching class ids from the link table first, same replacement used everywhere classTeacherId
// used to gate teacher access (assessment-submission/report/attendance controllers, learner.controller.js).
function classIdsTaughtBy(teacherId) {
  return new Set(ClassCourseTeacherLinkModel.findByTeacherId(teacherId).map((l) => l.classId));
}

const getAllClasses = asyncHandler(async (req, res) => {
  const { schoolId, teacherId, status } = req.query;
  const filters = { schoolId, status };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.schoolId = req.ownSchool.id;
  } else if (req.user.role === "branchAdmin") {
    if (!req.ownBranch) return res.json({ success: true, data: [], count: 0 });
    // ClassModel.findAll only matches a single schoolId — fetch every matching class (across
    // any hub) on the other filters, then narrow to this branch's hubs here.
    let records = await ClassService.getAllClasses({ status });
    records = records.filter((c) => isOwnHub(req, c.schoolId));
    if (teacherId) { const ids = classIdsTaughtBy(teacherId); records = records.filter((c) => ids.has(c.id)); }
    return res.json({ success: true, data: records, count: records.length });
  } else if (req.user.role === "teacher") {
    if (!req.ownTeacher) return res.json({ success: true, data: [], count: 0 });
    const records = (await ClassService.getAllClasses(filters)).filter((c) => classIdsTaughtBy(req.ownTeacher.id).has(c.id));
    return res.json({ success: true, data: records, count: records.length });
  }
  let records = await ClassService.getAllClasses(filters);
  if (teacherId) { const ids = classIdsTaughtBy(teacherId); records = records.filter((c) => ids.has(c.id)); }
  res.json({ success: true, data: records, count: records.length });
});

const getClassById = asyncHandler(async (req, res) => {
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, record.schoolId));
  if (req.user.role === "teacher") {
    assertOwn(ClassCourseTeacherLinkModel.findByClassId(record.id).some((l) => l.teacherId === req.ownTeacher?.id));
  }
  if (req.user.role === "learner") {
    const enrolled = req.ownLearner
      ? LearnerHubLinkModel.findByLearnerId(req.ownLearner.id).some((l) => l.classId === record.id)
      : false;
    assertOwn(enrolled);
  }
  res.json({ success: true, data: record });
});

// Course-educator assignment — per (class, course) pair, multiple co-equal educators allowed.
// Replaces the old single Class.classTeacherId. Assignment stays an admin/school/branchAdmin
// action, same posture as the old classTeacherId write (a plain class update).
const getClassCourseTeachers = asyncHandler(async (req, res) => {
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, record.schoolId));
  const links = ClassCourseTeacherLinkModel.findByClassId(req.params.id);
  const data = links.map((l) => ({ ...l, teacher: TeacherModel.findById(l.teacherId) })).filter((l) => l.teacher);
  res.json({ success: true, data });
});

const assignCourseTeacher = asyncHandler(async (req, res) => {
  const { courseId, teacherId } = req.body;
  if (!courseId || !teacherId) return res.status(400).json({ success: false, message: "courseId and teacherId are required" });
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, record.schoolId));
  const link = ClassCourseTeacherLinkModel.link(req.params.id, courseId, teacherId);
  res.status(201).json({ success: true, data: link });
});

const unassignCourseTeacher = asyncHandler(async (req, res) => {
  const { courseId, teacherId } = req.params;
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, record.schoolId));
  ClassCourseTeacherLinkModel.unlink(req.params.id, courseId, teacherId);
  res.json({ success: true });
});

// Marks one educator as the primary (currently-teaching) educator for a class's course, demoting
// any other co-teacher on that same course back to secondary. Same write posture as assign/unassign.
const setPrimaryCourseTeacher = asyncHandler(async (req, res) => {
  const { courseId, teacherId } = req.params;
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, record.schoolId));
  const link = ClassCourseTeacherLinkModel.setPrimary(req.params.id, courseId, teacherId);
  if (!link) return res.status(404).json({ success: false, message: "Educator is not assigned to this course" });
  res.json({ success: true, data: link });
});

// Flat list of every (class, course) link for one teacher, across every class — feeds
// TeacherViewPage's "my course assignments" list, grouped by class client-side. Registered
// ahead of "/:id" in the router (a literal path, not a class id).
const getCourseTeacherLinksForTeacher = asyncHandler(async (req, res) => {
  const { teacherId } = req.query;
  if (!teacherId) return res.json({ success: true, data: [] });
  if (req.user.role === "teacher") assertOwn(teacherId === req.ownTeacher?.id);
  const data = ClassCourseTeacherLinkModel.findByTeacherId(teacherId);
  res.json({ success: true, data });
});

const updateClass = asyncHandler(async (req, res) => {
  const data = pickPresent(updateClassSchema.parse(req.body), req.body);
  if (req.user.role === "school" || req.user.role === "branchAdmin") {
    const existing = await ClassService.getClassById(req.params.id);
    assertOwn(isOwnHub(req, existing.schoolId));
    data.schoolId = existing.schoolId;
  }
  const record = await ClassService.updateClass(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteClass = asyncHandler(async (req, res) => {
  if (req.user.role === "school" || req.user.role === "branchAdmin") {
    const existing = await ClassService.getClassById(req.params.id);
    assertOwn(isOwnHub(req, existing.schoolId));
  }
  const result = await ClassService.deleteClass(req.params.id);
  res.json({ success: true, ...result });
});

const bulkCreateClasses = asyncHandler(async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Expected a non-empty array" });
  }
  if (req.user.role === "school") {
    assertOwn(!!req.ownSchool);
    items.forEach((item) => { item.schoolId = req.ownSchool.id; });
  } else if (req.user.role === "branchAdmin") {
    items.forEach((item) => assertOwn(isOwnHub(req, item.schoolId)));
  }
  const parsed = items.map((item) => createClassSchema.parse(item));
  const records = await ClassService.bulkCreateClasses(parsed);
  res.status(201).json({ success: true, data: records, count: records.length });
});

module.exports = {
  createClass, getAllClasses, getClassById, updateClass, deleteClass, bulkCreateClasses,
  getClassCourseTeachers, assignCourseTeacher, unassignCourseTeacher, setPrimaryCourseTeacher,
  getCourseTeacherLinksForTeacher,
};
