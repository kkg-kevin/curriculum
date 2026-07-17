const asyncHandler = require("express-async-handler");
const TeacherService = require("./teacher.service");
const AuthService = require("../auth/auth.service");
const { createTeacherSchema, updateTeacherSchema } = require("./teacher.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

const createTeacher = asyncHandler(async (req, res) => {
  const { password, ...data } = createTeacherSchema.parse(req.body);
  if (req.user.role === "school") {
    assertOwn(!!req.ownSchool);
    data.schoolId = req.ownSchool.id;
  }
  // Create the login first — if it fails (e.g. the email already belongs to a different-role
  // account), nothing is written at all, rather than leaving a teacher record with no login.
  if (password) {
    await AuthService.setOrCreatePassword({ name: `${data.firstName} ${data.lastName}`, email: data.email, password, role: "teacher" });
  }
  const teacher = await TeacherService.createTeacher(data);
  res.status(201).json({ success: true, data: teacher });
});

const getAllTeachers = asyncHandler(async (req, res) => {
  const { schoolId, status, subject, email } = req.query;
  const filters = { schoolId, status, subject, email };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.schoolId = req.ownSchool.id;
  } else if (req.user.role === "teacher") {
    if (!req.ownTeacher) return res.json({ success: true, data: [], count: 0 });
    filters.email = req.ownTeacher.email;
  }
  const teachers = await TeacherService.getAllTeachers(filters);
  res.json({ success: true, data: teachers, count: teachers.length });
});

const getTeacherById = asyncHandler(async (req, res) => {
  const teacher = await TeacherService.getTeacherById(req.params.id);
  if (req.user.role === "school")  assertOwn(teacher.schoolId === req.ownSchool?.id);
  if (req.user.role === "teacher") assertOwn(teacher.id === req.ownTeacher?.id);
  res.json({ success: true, data: teacher });
});

// Self-service fields a teacher may change on their own record — deliberately excludes name,
// email, schoolId and status: email doubles as the login-matching key (changing it
// here would disconnect the account from this very record), and the rest are
// admin/school-controlled identity/assignment fields, not "my profile" fields. `password` is
// handled separately below (not in this list) — a teacher resetting their own login password is
// safe to allow since it can't touch email/role, unlike everything else this list guards against.
const TEACHER_SELF_EDIT_FIELDS = ["phone"];

const updateTeacher = asyncHandler(async (req, res) => {
  const parsed = updateTeacherSchema.parse(req.body);
  const { password, ...data } = parsed;
  if (req.user.role === "school") {
    const existing = await TeacherService.getTeacherById(req.params.id);
    assertOwn(existing.schoolId === req.ownSchool?.id);
    data.schoolId = existing.schoolId;
  } else if (req.user.role === "teacher") {
    assertOwn(req.params.id === req.ownTeacher?.id);
    Object.keys(data).forEach((key) => {
      if (!TEACHER_SELF_EDIT_FIELDS.includes(key)) delete data[key];
    });
  }
  const teacher = await TeacherService.updateTeacher(req.params.id, data);
  if (password) {
    if (!teacher.email) {
      const err = new Error("This teacher needs an email address before a password can be set");
      err.statusCode = 400;
      throw err;
    }
    await AuthService.setOrCreatePassword({ name: `${teacher.firstName} ${teacher.lastName}`, email: teacher.email, password, role: "teacher" });
  }
  res.json({ success: true, data: teacher });
});

const deleteTeacher = asyncHandler(async (req, res) => {
  if (req.user.role === "school") {
    const existing = await TeacherService.getTeacherById(req.params.id);
    assertOwn(existing.schoolId === req.ownSchool?.id);
  }
  const result = await TeacherService.deleteTeacher(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createTeacher, getAllTeachers, getTeacherById, updateTeacher, deleteTeacher };
