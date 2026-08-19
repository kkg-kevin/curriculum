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
  }
  const record = await ClassService.createClass(data);
  res.status(201).json({ success: true, data: record });
});

// A teacher's "my classes" is now every class with at least one course-educator link naming
// them — there's no more single classTeacherId to filter by directly, so this resolves the
// matching class ids from the link table first, same replacement used everywhere classTeacherId
// used to gate teacher access (assessment-submission/report/attendance controllers, learner.controller.js).
async function classIdsTaughtBy(teacherId) {
  const links = await ClassCourseTeacherLinkModel.findByTeacherId(teacherId);
  return new Set(links.map((l) => l.classId));
}

const getAllClasses = asyncHandler(async (req, res) => {
  const { schoolId, teacherId, status } = req.query;
  const filters = { schoolId, status };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.schoolId = req.ownSchool.id;
  } else if (req.user.role === "teacher") {
    if (!req.ownTeacher) return res.json({ success: true, data: [], count: 0 });
    const ids = await classIdsTaughtBy(req.ownTeacher.id);
    const records = (await ClassService.getAllClasses(filters)).filter((c) => ids.has(c.id));
    return res.json({ success: true, data: records, count: records.length });
  }
  let records = await ClassService.getAllClasses(filters);
  if (teacherId) { const ids = await classIdsTaughtBy(teacherId); records = records.filter((c) => ids.has(c.id)); }
  res.json({ success: true, data: records, count: records.length });
});

const getClassById = asyncHandler(async (req, res) => {
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school") assertOwn(isOwnHub(req, record.schoolId));
  if (req.user.role === "teacher") {
    const links = await ClassCourseTeacherLinkModel.findByClassId(record.id);
    assertOwn(links.some((l) => l.teacherId === req.ownTeacher?.id));
  }
  if (req.user.role === "learner") {
    const enrolled = req.ownLearner
      ? (await LearnerHubLinkModel.findByLearnerId(req.ownLearner.id)).some((l) => l.classId === record.id)
      : false;
    assertOwn(enrolled);
  }
  res.json({ success: true, data: record });
});

// Course-educator assignment — per (class, course) pair, multiple co-equal educators allowed.
// Replaces the old single Class.classTeacherId. Assignment stays an admin/school action, same
// posture as the old classTeacherId write (a plain class update).
const getClassCourseTeachers = asyncHandler(async (req, res) => {
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school") assertOwn(isOwnHub(req, record.schoolId));
  const links = await ClassCourseTeacherLinkModel.findByClassId(req.params.id);
  const resolved = await Promise.all(links.map(async (l) => ({ ...l, teacher: await TeacherModel.findById(l.teacherId) })));
  const data = resolved.filter((l) => l.teacher);
  res.json({ success: true, data });
});

const assignCourseTeacher = asyncHandler(async (req, res) => {
  const { courseId, teacherId } = req.body;
  if (!courseId || !teacherId) return res.status(400).json({ success: false, message: "courseId and teacherId are required" });
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school") assertOwn(isOwnHub(req, record.schoolId));
  // An empty/unset qualifiedCourseIds means unrestricted — the gate only activates once a
  // teacher has been given a specific, non-empty list (see teacher.validation.js).
  const teacher = await TeacherModel.findById(teacherId);
  if (!teacher) return res.status(404).json({ success: false, message: "Teacher not found" });
  if (teacher.qualifiedCourseIds?.length > 0 && !teacher.qualifiedCourseIds.includes(courseId)) {
    return res.status(400).json({ success: false, message: "This educator isn't qualified to teach this course." });
  }
  const link = await ClassCourseTeacherLinkModel.link(req.params.id, courseId, teacherId);
  res.status(201).json({ success: true, data: link });
});

const unassignCourseTeacher = asyncHandler(async (req, res) => {
  const { courseId, teacherId } = req.params;
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school") assertOwn(isOwnHub(req, record.schoolId));
  await ClassCourseTeacherLinkModel.unlink(req.params.id, courseId, teacherId);
  res.json({ success: true });
});

// Marks one educator as the primary (currently-teaching) educator for a class's course, demoting
// any other co-teacher on that same course back to secondary. Same write posture as assign/unassign.
const setPrimaryCourseTeacher = asyncHandler(async (req, res) => {
  const { courseId, teacherId } = req.params;
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school") assertOwn(isOwnHub(req, record.schoolId));
  const link = await ClassCourseTeacherLinkModel.setPrimary(req.params.id, courseId, teacherId);
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
  const data = await ClassCourseTeacherLinkModel.findByTeacherId(teacherId);
  res.json({ success: true, data });
});

// Per-learner readiness to move up to the next grade — computed live off the same completion
// signal the Reports page uses (see ClassService.getPromotionReadiness), plus the resolved next
// class (if Set Up Year has already created it). Same read access as the roster/course-teachers
// endpoints — anyone who can already see this class's detail page can see this.
const getPromotionReadiness = asyncHandler(async (req, res) => {
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school") assertOwn(isOwnHub(req, record.schoolId));
  if (req.user.role === "teacher") {
    const links = await ClassCourseTeacherLinkModel.findByClassId(record.id);
    assertOwn(links.some((l) => l.teacherId === req.ownTeacher?.id));
  }
  const data = await ClassService.getPromotionReadiness(req.params.id);
  res.json({ success: true, data });
});

// Moves the given learners into the next grade's class, once they're actually ready — same
// write posture as assignCourseTeacher/updateClass (admin/school only, see routes).
const promoteLearners = asyncHandler(async (req, res) => {
  const { learnerIds } = req.body;
  if (!Array.isArray(learnerIds) || learnerIds.length === 0) {
    return res.status(400).json({ success: false, message: "learnerIds is required" });
  }
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school") assertOwn(isOwnHub(req, record.schoolId));
  const data = await ClassService.promoteLearners(req.params.id, learnerIds);
  res.json({ success: true, data });
});

const updateClass = asyncHandler(async (req, res) => {
  const data = pickPresent(updateClassSchema.parse(req.body), req.body);
  if (req.user.role === "school") {
    const existing = await ClassService.getClassById(req.params.id);
    assertOwn(isOwnHub(req, existing.schoolId));
    data.schoolId = existing.schoolId;
  }
  const record = await ClassService.updateClass(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteClass = asyncHandler(async (req, res) => {
  if (req.user.role === "school") {
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
  }
  const parsed = items.map((item) => createClassSchema.parse(item));
  const records = await ClassService.bulkCreateClasses(parsed);
  res.status(201).json({ success: true, data: records, count: records.length });
});

module.exports = {
  createClass, getAllClasses, getClassById, updateClass, deleteClass, bulkCreateClasses,
  getClassCourseTeachers, assignCourseTeacher, unassignCourseTeacher, setPrimaryCourseTeacher,
  getCourseTeacherLinksForTeacher, getPromotionReadiness, promoteLearners,
};
