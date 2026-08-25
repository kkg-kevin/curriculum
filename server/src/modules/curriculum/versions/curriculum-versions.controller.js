const asyncHandler = require("express-async-handler");
const CurriculumVersionService = require("./curriculum-versions.service");
const CurriculumModel = require("../curriculum.model");
const LearningHubService = require("../../learning-hubs/learning-hub.service");
const TeacherHubLinkModel = require("../../teachers/teacher-hub-link.model");
const SchoolModel = require("../../learning-hubs/learning-hub.model");
const ClassModel = require("../../classes/class.model");
const LearnerHubLinkModel = require("../../learners/learner-hub-link.model");
const ProgramModel = require("../../programs/program.model");
const { assertOwn } = require("../../../shared/middleware/scope.middleware");

async function getTeacherAccessibleCurriculumIds(req) {
  if (!req.ownTeacher) return [];
  const links = await TeacherHubLinkModel.findByTeacherId(req.ownTeacher.id);
  const ids = new Set();
  for (const link of links) {
    const curriculumIds = await LearningHubService.getEffectiveCurriculumIds(link.hubId);
    curriculumIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}

async function assertCurriculumAccess(req, curriculumId) {
  if (req.user.role === "admin" || req.user.role === "curriculumAdmin") return;

  if (req.user.role === "school") {
    const accessible = new Set(req.ownSchoolCurriculumIds || (req.ownSchool?.curriculumId ? [req.ownSchool.curriculumId] : []));
    if (accessible.has(curriculumId)) return;
    const deployedPrograms = await ProgramModel.findAll({ curriculumId });
    if (deployedPrograms.some((p) => p.hubId === req.ownSchool?.id)) return;
    throw Object.assign(new Error("You do not have permission to access this record"), { statusCode: 403 });
  }

  if (req.user.role === "teacher") {
    const hubIds = req.ownTeacher ? (await TeacherHubLinkModel.findByTeacherId(req.ownTeacher.id)).map((l) => l.hubId) : [];
    const accessible = new Set(await getTeacherAccessibleCurriculumIds(req));
    if (accessible.has(curriculumId)) return;
    const hubs = await Promise.all(hubIds.map((hid) => SchoolModel.findById(hid)));
    if (hubs.some((hub) => hub?.curriculumId === curriculumId)) return;
    const deployedPrograms = await ProgramModel.findAll({ curriculumId });
    if (deployedPrograms.some((p) => hubIds.includes(p.hubId))) return;
    throw Object.assign(new Error("You do not have permission to access this record"), { statusCode: 403 });
  }

  if (req.user.role === "learner") {
    const links = await LearnerHubLinkModel.findByLearnerId(req.ownLearner?.id);
    const classes = await Promise.all(links.map((l) => ClassModel.findById(l.classId)));
    if (classes.some((cls) => cls?.curriculumId === curriculumId)) return;
    throw Object.assign(new Error("You do not have permission to access this record"), { statusCode: 403 });
  }

  throw Object.assign(new Error("You do not have permission to access this record"), { statusCode: 403 });
}

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
  await assertCurriculumAccess(req, req.params.id);
  const courses = await CurriculumVersionService.getCurrentCourses(req.params.id, req.query.gradeId || null);
  res.json({ success: true, data: courses });
});

module.exports = { getVersions, createVersion, editVersion, changeVersionStatus, getCurrentCourses };
