const asyncHandler = require("express-async-handler");
const QaService = require("./qa.service");
const V = require("./qa.validation");

// Request/response only — every rule lives in qa.service.js. A bad value comes back as its own
// readable sentence (and the full list in `errors`), not "Validation failed".
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
  listTemplates: asyncHandler(async (req, res) => ok(res, await QaService.listTemplates(req, req.query))),
  getTemplate: asyncHandler(async (req, res) => ok(res, await QaService.getTemplate(req, req.params.id))),
  createTemplate: asyncHandler(async (req, res) => ok(res, await QaService.createTemplate(req, parse(V.templateSchema, req.body)), 201)),
  updateTemplate: asyncHandler(async (req, res) => ok(res, await QaService.updateTemplate(req, req.params.id, parse(V.templateSchema, req.body)))),
  setTemplateStatus: asyncHandler(async (req, res) => ok(res, await QaService.setTemplateStatus(req, req.params.id, parse(V.templateStatusSchema, req.body).status))),
  deleteTemplate: asyncHandler(async (req, res) => {
    const result = await QaService.deleteTemplate(req, res, req.params.id);
    if (result) ok(res, result); // null: ?check=1 already answered
  }),

  educators: asyncHandler(async (req, res) => ok(res, await QaService.listEducators(req))),
  reviewers: asyncHandler(async (req, res) => ok(res, await QaService.reviewers(req))),

  listSchedules: asyncHandler(async (req, res) => ok(res, await QaService.listSchedules(req, req.query))),
  createSchedule: asyncHandler(async (req, res) => ok(res, await QaService.createSchedule(req, parse(V.scheduleSchema, req.body)), 201)),
  updateSchedule: asyncHandler(async (req, res) => ok(res, await QaService.updateSchedule(req, req.params.id, parse(V.scheduleSchema, req.body)))),
  endSchedule: asyncHandler(async (req, res) => ok(res, await QaService.endSchedule(req, req.params.id))),

  listVisits: asyncHandler(async (req, res) => ok(res, await QaService.listVisits(req, parse(V.listVisitsSchema, req.query)))),
  getVisit: asyncHandler(async (req, res) => ok(res, await QaService.getVisit(req, req.params.id))),
  createVisit: asyncHandler(async (req, res) => ok(res, await QaService.createVisit(req, parse(V.visitSchema, req.body)), 201)),
  updateVisit: asyncHandler(async (req, res) => ok(res, await QaService.updateVisit(req, req.params.id, parse(V.visitUpdateSchema, req.body)))),
  cancelVisit: asyncHandler(async (req, res) => ok(res, await QaService.cancelVisit(req, req.params.id))),
  saveReview: asyncHandler(async (req, res) => ok(res, await QaService.saveReview(req, req.params.id, parse(V.reviewSchema, req.body)))),
  saveReply: asyncHandler(async (req, res) => ok(res, await QaService.saveReply(req, req.params.id, parse(V.replySchema, req.body)))),
};
