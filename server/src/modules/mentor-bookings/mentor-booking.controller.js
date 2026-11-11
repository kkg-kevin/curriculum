const asyncHandler = require("express-async-handler");
const S = require("./mentor-booking.service");
const V = require("./mentor-booking.validation");

// Request/response only — every rule lives in mentor-booking.service.js.
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
  getSettings: handle((req) => S.getSettings(req)),
  updateSettings: handle((req) => S.updateSettings(req, parse(V.settingsSchema, req.body))),

  options: handle((req) => S.options(req, parse(V.optionsSchema, req.query))),
  freeTimes: handle((req) => S.freeTimes(req, parse(V.freeTimesSchema, req.query))),
  book: handle((req) => S.book(req, parse(V.bookSchema, req.body)), 201),

  list: handle((req) => S.list(req, parse(V.listSchema, req.query))),
  get: handle((req) => S.get(req, req.params.id)),
  cancel: handle((req) => S.cancel(req, req.params.id, parse(V.cancelSchema, req.body))),
  mark: handle((req) => S.mark(req, req.params.id, parse(V.markSchema, req.body))),
  setLink: handle((req) => S.setLink(req, req.params.id, parse(V.linkSchema, req.body))),
  markRefunded: handle((req) => S.markRefunded(req, req.params.id, parse(V.refundSchema, req.body))),

  askForHelp: handle((req) => S.askForHelp(req, parse(V.helpSchema, req.body)), 201),
  listHelp: handle((req) => S.listHelp(req)),
  closeHelp: handle((req) => S.closeHelp(req, req.params.id)),

  hubsOwed: handle((req) => S.hubsOwed(req)),
  statement: handle((req) => S.statement(req, req.params.hubId)),
  settle: handle((req) => S.settle(req, req.params.hubId, parse(V.settleSchema, req.body))),
};
