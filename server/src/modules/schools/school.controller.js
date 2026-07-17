const asyncHandler = require("express-async-handler");
const SchoolService = require("./school.service");
const { createSchoolSchema, updateSchoolSchema } = require("./school.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

// updateSchoolSchema is createSchoolSchema.partial(), but zod still materializes a field's
// .default(...) when its key is simply absent from the request body — e.g. an update body that
// omits "email" comes back from .parse() with email: "", silently wiping it. Recursively keep
// only keys actually present in the raw body so a genuinely partial update never overwrites a
// field the caller didn't send.
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

const createSchool = asyncHandler(async (req, res) => {
  const data = createSchoolSchema.parse(req.body);
  const school = await SchoolService.createSchool(data);
  res.status(201).json({ success: true, data: school });
});

const getAllSchools = asyncHandler(async (req, res) => {
  const { status, county, curriculumId, email } = req.query;
  const filters = { status, county, curriculumId, email };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.email = req.ownSchool.email;
  }
  const schools = await SchoolService.getAllSchools(filters);
  res.json({ success: true, data: schools, count: schools.length });
});

const getSchoolById = asyncHandler(async (req, res) => {
  const school = await SchoolService.getSchoolById(req.params.id);
  if (req.user.role === "school")  assertOwn(school.id === req.ownSchool?.id);
  if (req.user.role === "teacher") assertOwn(school.id === req.ownTeacher?.schoolId);
  if (req.user.role === "learner") assertOwn(school.id === req.ownLearner?.schoolId);
  res.json({ success: true, data: school });
});

const updateSchool = asyncHandler(async (req, res) => {
  const data = pickPresent(updateSchoolSchema.parse(req.body), req.body);
  if (req.user.role === "school") {
    const existing = await SchoolService.getSchoolById(req.params.id);
    assertOwn(existing.id === req.ownSchool?.id);
    // A school can update its own contact info, but code/status/curriculum assignment stay
    // platform-admin-controlled governance fields — force them back to their current values
    // regardless of what's in the request body.
    data.code = existing.code;
    data.status = existing.status;
    data.curriculumId = existing.curriculumId;
  }
  const school = await SchoolService.updateSchool(req.params.id, data);
  res.json({ success: true, data: school });
});

const deleteSchool = asyncHandler(async (req, res) => {
  const result = await SchoolService.deleteSchool(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createSchool, getAllSchools, getSchoolById, updateSchool, deleteSchool };
