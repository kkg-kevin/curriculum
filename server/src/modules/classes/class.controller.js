const asyncHandler = require("express-async-handler");
const ClassService = require("./class.service");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const { createClassSchema, updateClassSchema } = require("./class.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

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

const getAllClasses = asyncHandler(async (req, res) => {
  const { schoolId, classTeacherId, status } = req.query;
  const filters = { schoolId, classTeacherId, status };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.schoolId = req.ownSchool.id;
  } else if (req.user.role === "teacher") {
    if (!req.ownTeacher) return res.json({ success: true, data: [], count: 0 });
    filters.classTeacherId = req.ownTeacher.id;
  }
  const records = await ClassService.getAllClasses(filters);
  res.json({ success: true, data: records, count: records.length });
});

const getClassById = asyncHandler(async (req, res) => {
  const record = await ClassService.getClassById(req.params.id);
  if (req.user.role === "school")  assertOwn(record.schoolId === req.ownSchool?.id);
  if (req.user.role === "teacher") assertOwn(record.classTeacherId === req.ownTeacher?.id);
  if (req.user.role === "learner") {
    const enrolled = req.ownLearner
      ? LearnerHubLinkModel.findByLearnerId(req.ownLearner.id).some((l) => l.classId === record.id)
      : false;
    assertOwn(enrolled);
  }
  res.json({ success: true, data: record });
});

const updateClass = asyncHandler(async (req, res) => {
  const data = pickPresent(updateClassSchema.parse(req.body), req.body);
  if (req.user.role === "school") {
    const existing = await ClassService.getClassById(req.params.id);
    assertOwn(existing.schoolId === req.ownSchool?.id);
    data.schoolId = existing.schoolId;
  }
  const record = await ClassService.updateClass(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteClass = asyncHandler(async (req, res) => {
  if (req.user.role === "school") {
    const existing = await ClassService.getClassById(req.params.id);
    assertOwn(existing.schoolId === req.ownSchool?.id);
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

module.exports = { createClass, getAllClasses, getClassById, updateClass, deleteClass, bulkCreateClasses };
