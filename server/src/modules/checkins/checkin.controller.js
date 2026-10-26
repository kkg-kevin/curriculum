const asyncHandler = require("express-async-handler");
const CheckinService = require("./checkin.service");
const V = require("./checkin.validation");

// Request/response only — every rule lives in checkin.service.js. A bad value comes back as its
// own readable sentence (and the full list in `errors`), not "Validation failed".
function parse(schema, input) {
  const result = schema.safeParse(input || {});
  if (!result.success) {
    throw Object.assign(new Error(result.error.issues[0]?.message || "Please check the details"), {
      statusCode: 400,
      errors: result.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  return result.data;
}

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

module.exports = {
  people: asyncHandler(async (req, res) => ok(res, await CheckinService.people(req))),
  hubs: asyncHandler(async (req, res) => ok(res, await CheckinService.hubs(req))),
  due: asyncHandler(async (req, res) => ok(res, await CheckinService.dueForMe(req))),

  listSchedules: asyncHandler(async (req, res) => ok(res, await CheckinService.listSchedules(req, req.query))),
  createSchedule: asyncHandler(async (req, res) => ok(res, await CheckinService.createSchedule(req, parse(V.scheduleSchema, req.body)), 201)),
  updateSchedule: asyncHandler(async (req, res) => ok(res, await CheckinService.updateSchedule(req, req.params.id, parse(V.scheduleSchema, req.body)))),
  endSchedule: asyncHandler(async (req, res) => ok(res, await CheckinService.endSchedule(req, req.params.id))),

  listSessions: asyncHandler(async (req, res) => ok(res, await CheckinService.listSessions(req, parse(V.listSessionsSchema, req.query)))),
  getSession: asyncHandler(async (req, res) => ok(res, await CheckinService.getSession(req, req.params.id))),
  saveReport: asyncHandler(async (req, res) => ok(res, await CheckinService.saveReport(req, req.params.id, parse(V.reportSchema, req.body)))),
};
