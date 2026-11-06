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

  listTemplates: asyncHandler(async (req, res) => ok(res, await CheckinService.listTemplates(req, req.query))),
  getTemplate: asyncHandler(async (req, res) => ok(res, await CheckinService.getTemplate(req, req.params.id))),
  createTemplate: asyncHandler(async (req, res) => ok(res, await CheckinService.createTemplate(req, parse(V.templateSchema, req.body)), 201)),
  updateTemplate: asyncHandler(async (req, res) => ok(res, await CheckinService.updateTemplate(req, req.params.id, parse(V.templateSchema, req.body)))),
  setTemplateStatus: asyncHandler(async (req, res) => ok(res, await CheckinService.setTemplateStatus(req, req.params.id, parse(V.templateStatusSchema, req.body).status))),
  deleteTemplate: asyncHandler(async (req, res) => {
    const result = await CheckinService.deleteTemplate(req, res, req.params.id);
    if (result) ok(res, result); // null: ?check=1 already answered
  }),
  hubs: asyncHandler(async (req, res) => ok(res, await CheckinService.hubs(req))),
  hubPeople: asyncHandler(async (req, res) => ok(res, await CheckinService.hubPeople(req, req.params.id))),
  due: asyncHandler(async (req, res) => ok(res, await CheckinService.dueForMe(req))),

  listSchedules: asyncHandler(async (req, res) => ok(res, await CheckinService.listSchedules(req, req.query))),
  createSchedule: asyncHandler(async (req, res) => ok(res, await CheckinService.createSchedule(req, parse(V.scheduleSchema, req.body)), 201)),
  updateSchedule: asyncHandler(async (req, res) => ok(res, await CheckinService.updateSchedule(req, req.params.id, parse(V.scheduleSchema, req.body)))),
  endSchedule: asyncHandler(async (req, res) => ok(res, await CheckinService.endSchedule(req, req.params.id))),

  listSessions: asyncHandler(async (req, res) => ok(res, await CheckinService.listSessions(req, parse(V.listSessionsSchema, req.query)))),
  getSession: asyncHandler(async (req, res) => ok(res, await CheckinService.getSession(req, req.params.id))),
  saveReport: asyncHandler(async (req, res) => ok(res, await CheckinService.saveReport(req, req.params.id, parse(V.reportSchema, req.body)))),

  listTasks: asyncHandler(async (req, res) => ok(res, await CheckinService.listTasks(req, parse(V.listTasksSchema, req.query)))),
  createTask: asyncHandler(async (req, res) => ok(res, await CheckinService.createTask(req, req.params.id, parse(V.taskSchema, req.body)), 201)),
  updateTask: asyncHandler(async (req, res) => ok(res, await CheckinService.updateTask(req, req.params.id, parse(V.taskSchema, req.body)))),
  setTaskStatus: asyncHandler(async (req, res) => ok(res, await CheckinService.setTaskStatus(req, req.params.id, parse(V.taskStatusSchema, req.body).status))),
  deleteTask: asyncHandler(async (req, res) => ok(res, await CheckinService.deleteTask(req, req.params.id))),
};
