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
  overview: asyncHandler(async (req, res) => ok(res, await CheckinService.overview(req, parse(V.overviewSchema, req.query)))),

  listSchedules: asyncHandler(async (req, res) => ok(res, await CheckinService.listSchedules(req, req.query))),
  createSchedule: asyncHandler(async (req, res) => ok(res, await CheckinService.createSchedule(req, parse(V.scheduleSchema, req.body)), 201)),
  updateSchedule: asyncHandler(async (req, res) => ok(res, await CheckinService.updateSchedule(req, req.params.id, parse(V.updateScheduleSchema, req.body)))),
  endSchedule: asyncHandler(async (req, res) => ok(res, await CheckinService.endSchedule(req, req.params.id, parse(V.endScheduleSchema, req.body)))),

  listSessions: asyncHandler(async (req, res) => ok(res, await CheckinService.listSessions(req, parse(V.listSessionsSchema, req.query)))),
  getSession: asyncHandler(async (req, res) => ok(res, await CheckinService.getSession(req, req.params.id))),
  saveReport: asyncHandler(async (req, res) => ok(res, await CheckinService.saveReport(req, req.params.id, parse(V.reportSchema, req.body)))),
  submitReport: asyncHandler(async (req, res) => ok(res, await CheckinService.submitReport(req, req.params.id))),
  reopenReport: asyncHandler(async (req, res) => ok(res, await CheckinService.reopenReport(req, req.params.id, parse(V.reasonSchema, req.body)))),
  rescheduleSession: asyncHandler(async (req, res) => ok(res, await CheckinService.rescheduleSession(req, req.params.id, parse(V.rescheduleSchema, req.body)))),
  cancelSession: asyncHandler(async (req, res) => ok(res, await CheckinService.cancelSession(req, req.params.id, parse(V.reasonSchema, req.body)))),

  listActions: asyncHandler(async (req, res) => ok(res, await CheckinService.listActions(req, parse(V.listActionsSchema, req.query)))),
  getAction: asyncHandler(async (req, res) => ok(res, await CheckinService.getAction(req, req.params.id))),
  createAction: asyncHandler(async (req, res) => ok(res, await CheckinService.createAction(req, req.params.id, parse(V.createActionSchema, req.body)), 201)),
  updateAction: asyncHandler(async (req, res) => ok(res, await CheckinService.updateAction(req, req.params.id, parse(V.updateActionSchema, req.body)))),
  setActionStatus: asyncHandler(async (req, res) => ok(res, await CheckinService.setActionStatus(req, req.params.id, parse(V.actionStatusSchema, req.body)))),
  addActionNote: asyncHandler(async (req, res) => ok(res, await CheckinService.addActionNote(req, req.params.id, parse(V.noteSchema, req.body)))),
  escalateAction: asyncHandler(async (req, res) => ok(res, await CheckinService.escalateAction(req, req.params.id, parse(V.escalateSchema, req.body)))),
  deleteAction: asyncHandler(async (req, res) => ok(res, await CheckinService.deleteAction(req, req.params.id))),
};
