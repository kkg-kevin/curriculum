const asyncHandler = require("express-async-handler");
const PublicBootcampService = require("./public-bootcamp.service");

// digifunzi-landing's Bootcamps section (/bootcamps, /bootcamps/:slug). Bare array/object
// responses (no { success, data } wrapper) — same convention as public-site.controller.js,
// public-project.controller.js and public-store.controller.js. 404s an unknown id/slug OR a
// bootcamp that isn't for sale / belongs to another admin (undifferentiated, so a probing
// client can't tell which).

const getPublicBootcamps = asyncHandler(async (req, res) => {
  const records = await PublicBootcampService.listBootcamps();
  res.json(records);
});

const getPublicBootcamp = asyncHandler(async (req, res) => {
  const record = await PublicBootcampService.getBootcamp(req.params.idOrSlug);
  if (!record) return res.status(404).json({ message: "Bootcamp not found" });
  res.json(record);
});

module.exports = { getPublicBootcamps, getPublicBootcamp };
