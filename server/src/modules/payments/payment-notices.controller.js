const asyncHandler = require("express-async-handler");
const PaymentNotices = require("./payment-notices.service");
const PaymentOptions = require("./payment-options");
const {
  paymentOptionsSchema, submitNoticeSchema, noticeQuerySchema, confirmNoticeSchema, rejectNoticeSchema,
} = require("./payment-notices.validation");

// Parents fill some of these in, so a bad value comes back as one readable sentence.
function parse(schema, input) {
  const result = schema.safeParse(input || {});
  if (!result.success) throw Object.assign(new Error(result.error.issues[0]?.message || "Please check the details"), { statusCode: 400 });
  return result.data;
}

// ---- Website: the Payment step (payment link) ----

const submitForLink = asyncHandler(async (req, res) => {
  const data = parse(submitNoticeSchema, req.body);
  res.status(201).json({ success: true, data: await PaymentNotices.submitForLink(req.params.token, data) });
});

// ---- Billing → To confirm ----

const list = asyncHandler(async (req, res) => {
  const { status } = parse(noticeQuerySchema, req.query);
  res.json({ success: true, data: await PaymentNotices.list(req, { status }) });
});

const confirm = asyncHandler(async (req, res) => {
  const data = parse(confirmNoticeSchema, req.body);
  res.json({ success: true, data: await PaymentNotices.confirm(req.params.id, data, req) });
});

const reject = asyncHandler(async (req, res) => {
  const data = parse(rejectNoticeSchema, req.body);
  res.json({ success: true, data: await PaymentNotices.reject(req.params.id, data, req) });
});

// ---- Settings → Payments → How families can pay ----

const getOptions = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await PaymentOptions.get(req) });
});

const saveOptions = asyncHandler(async (req, res) => {
  const data = parse(paymentOptionsSchema, req.body);
  res.json({ success: true, data: await PaymentOptions.save(req, data) });
});

module.exports = { submitForLink, list, confirm, reject, getOptions, saveOptions };
