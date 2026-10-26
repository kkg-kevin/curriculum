const asyncHandler = require("express-async-handler");
const ParentService = require("./parent.service");
const { childLoginSchema, rangeSchema } = require("./parent.validation");

const overview = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await ParentService.overview(req) });
});

const timetable = asyncHandler(async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  const { events, breaks, skippedSessions } = await ParentService.timetable(req, from, to);
  res.json({ success: true, data: events, breaks, skippedSessions, count: events.length });
});

const childLogin = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await ParentService.childLogin(req, req.params.id) });
});

const setChildLogin = asyncHandler(async (req, res) => {
  const data = childLoginSchema.parse(req.body);
  res.json({ success: true, data: await ParentService.setChildLogin(req, req.params.id, data) });
});

module.exports = { overview, timetable, childLogin, setChildLogin };
