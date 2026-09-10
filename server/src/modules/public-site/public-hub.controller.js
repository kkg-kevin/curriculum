const asyncHandler = require("express-async-handler");
const PublicHubService = require("./public-hub.service");

// digifunzi-landing's enrolment flow. Bare array responses (no { success, data } wrapper) —
// same convention as public-site / public-project / public-store / public-bootcamp controllers.

const getPublicHubTypes = asyncHandler(async (req, res) => {
  const records = await PublicHubService.listTypes();
  res.json(records);
});

const getPublicHubs = asyncHandler(async (req, res) => {
  const records = await PublicHubService.listHubs(req.query.type || null);
  res.json(records);
});

module.exports = { getPublicHubTypes, getPublicHubs };
