const asyncHandler = require("express-async-handler");
const CurriculumService = require("./curriculum.service");
const AuthService = require("../auth/auth.service");
const { createCurriculumSchema, updateCurriculumSchema, linkCourseSchema, assignAdminSchema } = require("./curriculum.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const SchoolModel = require("../learning-hubs/learning-hub.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const ProgramModel = require("../programs/program.model");

const createCurriculum = asyncHandler(async (req, res) => {
  const data = createCurriculumSchema.parse(req.body);
  const curriculum = await CurriculumService.createCurriculum(data);
  res.status(201).json({ success: true, data: curriculum });
});

const getAllCurricula = asyncHandler(async (req, res) => {
  const { framework, academicYear } = req.query;
  const curricula = await CurriculumService.getAllCurricula({ framework, academicYear });
  res.json({ success: true, data: curricula, count: curricula.length });
});

// What a "curriculumAdmin" account lands on after login — their own assigned curriculum,
// resolved off req.ownCurriculum (attachOwnRecords) rather than a client-supplied id.
const getMyCurriculum = asyncHandler(async (req, res) => {
  if (!req.ownCurriculum) {
    const err = new Error("No curriculum is assigned to this account yet");
    err.statusCode = 404;
    throw err;
  }
  const curriculum = await CurriculumService.getCurriculumById(req.ownCurriculum.id);
  res.json({ success: true, data: curriculum });
});

const getCurriculumById = asyncHandler(async (req, res) => {
  const curriculum = await CurriculumService.getCurriculumById(req.params.id);
  // A school/teacher reads either their own hub's primary curriculum, OR one deployed onto
  // that same hub via a Program — a hub isn't limited to a single curriculum once a Program's
  // in play, so checking only the hub's own curriculumId field (as this used to) 403'd a
  // school/teacher on their own hub's real, deployed Program curriculum. A curriculumAdmin
  // only ever reads the one curriculum they're assigned to manage — never another curriculum,
  // even by guessing an id.
  if (req.user.role === "school") {
    const isOwnPrimary = req.ownSchool?.curriculumId === curriculum.id;
    const isDeployedProgram = ProgramModel.findAll({ curriculumId: curriculum.id }).some((p) => p.hubId === req.ownSchool?.id);
    assertOwn(isOwnPrimary || isDeployedProgram);
  } else if (req.user.role === "teacher") {
    const hubIds = req.ownTeacher ? TeacherHubLinkModel.findByTeacherId(req.ownTeacher.id).map((l) => l.hubId) : [];
    const isOwnPrimary = hubIds.some((hid) => SchoolModel.findById(hid)?.curriculumId === curriculum.id);
    const isDeployedProgram = ProgramModel.findAll({ curriculumId: curriculum.id }).some((p) => hubIds.includes(p.hubId));
    assertOwn(isOwnPrimary || isDeployedProgram);
  } else if (req.user.role === "curriculumAdmin") {
    assertOwn(req.ownCurriculum?.id === curriculum.id);
  }
  res.json({ success: true, data: curriculum });
});

const updateCurriculum = asyncHandler(async (req, res) => {
  const data = updateCurriculumSchema.parse(req.body);
  const curriculum = await CurriculumService.updateCurriculum(req.params.id, data);
  res.json({ success: true, data: curriculum });
});

const deleteCurriculum = asyncHandler(async (req, res) => {
  const result = await CurriculumService.deleteCurriculum(req.params.id);
  res.json({ success: true, ...result });
});

/* ── Curriculum admin — the one account delegated to author this curriculum (admin-only) ─── */

// Creates (or reuses, if already registered under the "curriculumAdmin" role) the login, then
// points this curriculum's curriculumAdminId at it — replacing whoever was assigned before,
// since there's only ever one at a time (mirrors reassigning class.classTeacherId).
const assignCurriculumAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = assignAdminSchema.parse(req.body);
  const user = await AuthService.setOrCreatePassword({ name, email, password, role: "curriculumAdmin" });
  const curriculum = await CurriculumService.setCurriculumAdmin(req.params.id, user.id);
  res.json({ success: true, data: curriculum });
});

const unassignCurriculumAdmin = asyncHandler(async (req, res) => {
  const curriculum = await CurriculumService.setCurriculumAdmin(req.params.id, null);
  res.json({ success: true, data: curriculum });
});

/* ── Courses (added to this curriculum from here) ─────────────────────────── */

const getCurriculumCourses = asyncHandler(async (req, res) => {
  const data = await CurriculumService.getCurriculumCourses(req.params.id);
  res.json({ success: true, data });
});

const linkCourse = asyncHandler(async (req, res) => {
  const { courseId } = linkCourseSchema.parse(req.body);
  const data = await CurriculumService.linkCourse(req.params.id, courseId);
  res.status(201).json({ success: true, data });
});

const unlinkCourse = asyncHandler(async (req, res) => {
  const data = await CurriculumService.unlinkCourse(req.params.id, req.params.courseId);
  res.json({ success: true, data });
});

module.exports = {
  createCurriculum,
  getAllCurricula,
  getMyCurriculum,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
  getCurriculumCourses,
  linkCourse,
  unlinkCourse,
  assignCurriculumAdmin,
  unassignCurriculumAdmin,
};
