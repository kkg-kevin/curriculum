const asyncHandler = require("express-async-handler");
const S = require("./mentor-checkin.service");
const V = require("./mentor-checkin.validation");

// Request/response only — every rule lives in mentor-checkin.service.js. A bad value comes back as
// its own readable sentence (and the full list in `errors`).
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
const handle = (fn, status) => asyncHandler(async (req, res) => ok(res, await fn(req), status));

module.exports = {
  listTemplates: handle((req) => S.listTemplates(req, req.query)),
  getTemplate: handle((req) => S.getTemplate(req, req.params.id)),
  createTemplate: handle((req) => S.createTemplate(req, parse(V.templateSchema, req.body)), 201),
  updateTemplate: handle((req) => S.updateTemplate(req, req.params.id, parse(V.templateSchema, req.body))),
  setTemplateStatus: handle((req) => S.setTemplateStatus(req, req.params.id, parse(V.templateStatusSchema, req.body).status)),
  deleteTemplate: asyncHandler(async (req, res) => {
    const result = await S.deleteTemplate(req, res, req.params.id);
    if (result) ok(res, result); // null: ?check=1 already answered
  }),

  hubs: handle((req) => S.hubs(req)),
  hubClasses: handle((req) => S.hubClasses(req, req.params.id)),
  classPeople: handle((req) => S.classPeople(req, req.params.id)),
  due: handle((req) => S.due(req)),

  preview: handle((req) => S.preview(req, parse(V.previewSchema, req.body))),
  listRounds: handle((req) => S.listRounds(req, req.query)),
  createRound: handle((req) => S.createRound(req, parse(V.roundSchema, req.body)), 201),
  getRound: handle((req) => S.getRound(req, req.params.id)),
  updateRound: handle((req) => S.updateRound(req, req.params.id, parse(V.roundUpdateSchema, req.body))),
  cancelRound: handle((req) => S.cancelRound(req, req.params.id)),

  listMeetings: handle((req) => S.listMeetings(req, parse(V.listMeetingsSchema, req.query))),
  getMeeting: handle((req) => S.getMeeting(req, req.params.id)),
  freeTimes: handle((req) => S.freeTimes(req, req.params.id)),
  changeTime: handle((req) => S.changeTime(req, req.params.id, parse(V.timeSchema, req.body))),
  confirm: handle((req) => S.confirm(req, req.params.id)),
  cancelMeeting: handle((req) => S.cancelMeeting(req, req.params.id)),
  setMissed: handle((req) => S.setMissed(req, req.params.id, parse(V.missedSchema, req.body).missed)),
  saveReport: handle((req) => S.saveReport(req, req.params.id, parse(V.reportSchema, req.body))),
  approve: handle((req) => S.approve(req, req.params.id, parse(V.approveSchema, req.body))),
};
