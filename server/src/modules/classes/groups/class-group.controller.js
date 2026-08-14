const asyncHandler = require("express-async-handler");
const ClassGroupService = require("./class-group.service");
const ClassModel = require("../class.model");
const ClassCourseTeacherLinkModel = require("../class-course-teacher-link.model");
const { assertOwn, isOwnHub } = require("../../../shared/middleware/scope.middleware");
const { createGroupSchema, renameGroupSchema, addMemberSchema } = require("./class-group.validation");

// Groups are a class-scoped resource with the same three-role ownership story attendance
// already uses: school/branchAdmin via isOwnHub, teacher via a course-educator link in the
// class. Admin passes through unrestricted, same as every other class-scoped controller.
async function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, cls.schoolId));
  if (req.user.role === "teacher") {
    const links = await ClassCourseTeacherLinkModel.findByClassId(cls.id);
    assertOwn(links.some((l) => l.teacherId === req.ownTeacher?.id));
  }
}

async function loadGroupAndAssertAccess(req) {
  const group = await ClassGroupService.getGroup(req.params.id);
  if (!group) {
    const err = new Error("Group not found");
    err.statusCode = 404;
    throw err;
  }
  const cls = await ClassModel.findById(group.classId);
  await assertClassAccess(req, cls);
  return group;
}

const createGroup = asyncHandler(async (req, res) => {
  const data = createGroupSchema.parse(req.body);
  const cls = await ClassModel.findById(data.classId);
  await assertClassAccess(req, cls);
  const group = await ClassGroupService.createGroup(data);
  res.status(201).json({ success: true, data: group });
});

// Combined payload — the class's groups plus its still-ungrouped active learners in one call,
// same "bundle related things" shape getRosterForIssue already uses for issue/assessment/roster.
const listGroupsForClass = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const [groups, ungroupedLearners] = await Promise.all([
    ClassGroupService.listGroupsForClass(classId),
    ClassGroupService.getUngroupedLearners(classId),
  ]);
  res.json({ success: true, data: { groups, ungroupedLearners } });
});

const renameGroup = asyncHandler(async (req, res) => {
  await loadGroupAndAssertAccess(req);
  const { name } = renameGroupSchema.parse(req.body);
  const group = await ClassGroupService.renameGroup(req.params.id, name);
  res.json({ success: true, data: group });
});

const deleteGroup = asyncHandler(async (req, res) => {
  await loadGroupAndAssertAccess(req);
  const result = await ClassGroupService.deleteGroup(req.params.id);
  res.json({ success: true, ...result });
});

const addMember = asyncHandler(async (req, res) => {
  await loadGroupAndAssertAccess(req);
  const { learnerId } = addMemberSchema.parse(req.body);
  const group = await ClassGroupService.addMember(req.params.id, learnerId);
  res.status(201).json({ success: true, data: group });
});

const removeMember = asyncHandler(async (req, res) => {
  await loadGroupAndAssertAccess(req);
  const group = await ClassGroupService.removeMember(req.params.id, req.params.learnerId);
  res.json({ success: true, data: group });
});

// Dual ownership, same shape as assessment-submission.controller.js's getDiagnosticForLearner:
// a learner reads only their own group; every staff role reads any learner's group within a
// class they own.
const getGroupForLearner = asyncHandler(async (req, res) => {
  const { learnerId, classId } = req.params;
  if (req.user.role === "learner") {
    assertOwn(learnerId === req.ownLearner?.id);
  } else {
    const cls = await ClassModel.findById(classId);
    await assertClassAccess(req, cls);
  }
  const group = await ClassGroupService.getGroupForLearner(classId, learnerId);
  res.json({ success: true, data: group });
});

module.exports = {
  createGroup,
  listGroupsForClass,
  renameGroup,
  deleteGroup,
  addMember,
  removeMember,
  getGroupForLearner,
};
