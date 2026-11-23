const asyncHandler = require("express-async-handler");
const Planner = require("./timetable-planner.service");
const { calendarRangeSchema, plannerLessonSchema, plannerCopySchema } = require("./timetable.validation");

// Request/response only — every rule, including which hubs this person may plan, is in
// timetable-planner.service.js.
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const overview = asyncHandler(async (req, res) => ok(res, await Planner.overview(req, { hubId: req.query.hubId || null })));

const calendar = asyncHandler(async (req, res) => {
  const { from, to } = calendarRangeSchema.parse(req.query);
  const out = await Planner.calendar(req, { hubId: req.query.hubId || null, from, to });
  res.json({ success: true, ...out, count: out.data.length });
});

const check = asyncHandler(async (req, res) => ok(res, await Planner.check(req, plannerLessonSchema.parse(req.body))));

const saveLessons = asyncHandler(async (req, res) => {
  try {
    ok(res, await Planner.saveLessons(req, plannerLessonSchema.parse(req.body)), 201);
  } catch (err) {
    // The page acts on these (asks before moving a start date with sessions already held).
    if (err.code === "HAS_HELD_SESSIONS" || err.code === "OUTSIDE_RUN" || err.code === "NO_SLOT") {
      return res.status(err.statusCode || 409).json({ success: false, message: err.message, code: err.code, heldCount: err.heldCount });
    }
    throw err;
  }
});

const copyPreview = asyncHandler(async (req, res) => ok(res, await Planner.copyPreview(req, plannerCopySchema.parse(req.body))));
const copyApply = asyncHandler(async (req, res) => ok(res, await Planner.copyApply(req, plannerCopySchema.parse(req.body))));

module.exports = { overview, calendar, check, saveLessons, copyPreview, copyApply };
