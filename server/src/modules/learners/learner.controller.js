const asyncHandler = require("express-async-handler");
const LearnerService = require("./learner.service");
const { createLearnerSchema, updateLearnerSchema } = require("./learner.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const ClassModel = require("../classes/class.model");

// A learner belongs to a class, and a class belongs to a teacher — this is the only place a
// teacher's access to a learner is decided, so both getAllLearners and getLearnerById go through it.
function classTaughtByTeacher(classId, teacherId) {
  if (!classId) return false;
  const cls = ClassModel.findById(classId);
  return !!cls && cls.classTeacherId === teacherId;
}

const createLearner = asyncHandler(async (req, res) => {
  const data = createLearnerSchema.parse(req.body);
  if (req.user.role === "school") {
    assertOwn(!!req.ownSchool);
    data.schoolId = req.ownSchool.id;
  }
  const record = await LearnerService.createLearner(data);
  res.status(201).json({ success: true, data: record });
});

const getAllLearners = asyncHandler(async (req, res) => {
  const { schoolId, classId, status, guardianEmail } = req.query;
  const filters = { schoolId, classId, status, guardianEmail };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.schoolId = req.ownSchool.id;
  } else if (req.user.role === "teacher") {
    if (!req.ownTeacher || !classTaughtByTeacher(classId, req.ownTeacher.id)) {
      return res.json({ success: true, data: [], count: 0 });
    }
  } else if (req.user.role === "learner") {
    if (!req.ownLearner) return res.json({ success: true, data: [], count: 0 });
    filters.guardianEmail = req.ownLearner.guardianEmail;
  }
  const records = await LearnerService.getAllLearners(filters);
  res.json({ success: true, data: records, count: records.length });
});

const getLearnerById = asyncHandler(async (req, res) => {
  const record = await LearnerService.getLearnerById(req.params.id);
  if (req.user.role === "school")  assertOwn(record.schoolId === req.ownSchool?.id);
  if (req.user.role === "teacher") assertOwn(classTaughtByTeacher(record.classId, req.ownTeacher?.id));
  if (req.user.role === "learner") assertOwn(record.id === req.ownLearner?.id);
  res.json({ success: true, data: record });
});

const updateLearner = asyncHandler(async (req, res) => {
  const data = updateLearnerSchema.parse(req.body);
  if (req.user.role === "school") {
    const existing = await LearnerService.getLearnerById(req.params.id);
    assertOwn(existing.schoolId === req.ownSchool?.id);
    data.schoolId = existing.schoolId;
  }
  const record = await LearnerService.updateLearner(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteLearner = asyncHandler(async (req, res) => {
  if (req.user.role === "school") {
    const existing = await LearnerService.getLearnerById(req.params.id);
    assertOwn(existing.schoolId === req.ownSchool?.id);
  }
  const result = await LearnerService.deleteLearner(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createLearner, getAllLearners, getLearnerById, updateLearner, deleteLearner };
