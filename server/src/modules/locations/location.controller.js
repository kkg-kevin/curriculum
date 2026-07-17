const asyncHandler = require("express-async-handler");
const LocationService = require("./location.service");
const { createLocationSchema, updateLocationSchema } = require("./location.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

// updateLocationSchema is baseLocationSchema.partial(), but zod still materializes a field's
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

const createLocation = asyncHandler(async (req, res) => {
  const data = createLocationSchema.parse(req.body);
  const record = await LocationService.createLocation(data);
  res.status(201).json({ success: true, data: record });
});

const getAllLocations = asyncHandler(async (req, res) => {
  const { status, county, curriculumId, email, locationType } = req.query;
  const filters = { status, county, curriculumId, email, locationType };
  // A "school"-role account only ever sees its own record (the account is matched to whichever
  // location has its email — see scope.middleware.js's attachOwnRecords).
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.email = req.ownSchool.email;
  }
  const records = await LocationService.getAllLocations(filters);
  res.json({ success: true, data: records, count: records.length });
});

const getLocationById = asyncHandler(async (req, res) => {
  const record = await LocationService.getLocationById(req.params.id);
  if (req.user.role === "school")  assertOwn(record.id === req.ownSchool?.id);
  if (req.user.role === "teacher") assertOwn(record.id === req.ownTeacher?.schoolId);
  if (req.user.role === "learner") assertOwn(record.id === req.ownLearner?.schoolId);
  res.json({ success: true, data: record });
});

const updateLocation = asyncHandler(async (req, res) => {
  const data = pickPresent(updateLocationSchema.parse(req.body), req.body);
  if (req.user.role === "school") {
    const existing = await LocationService.getLocationById(req.params.id);
    assertOwn(existing.id === req.ownSchool?.id);
    // A school can update its own contact info, but code/status/curriculum assignment/type stay
    // platform-admin-controlled governance fields — force them back to their current values
    // regardless of what's in the request body.
    data.code = existing.code;
    data.status = existing.status;
    data.curriculumId = existing.curriculumId;
    data.locationType = existing.locationType;
  }
  const record = await LocationService.updateLocation(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteLocation = asyncHandler(async (req, res) => {
  const result = await LocationService.deleteLocation(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createLocation, getAllLocations, getLocationById, updateLocation, deleteLocation };
