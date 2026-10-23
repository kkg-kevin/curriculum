const asyncHandler = require("express-async-handler");
const OrdersService = require("./orders.service");
const { placeOrderSchema, listQuerySchema, statusSchema } = require("./orders.validation");
const { visitSourceFrom } = require("../leads/visit-source");

// Shoppers fill some of these in, so a bad value comes back as one readable sentence.
function parse(schema, input) {
  const result = schema.safeParse(input || {});
  if (!result.success) throw Object.assign(new Error(result.error.issues[0]?.message || "Please check the details"), { statusCode: 400 });
  return result.data;
}

// ---- Website ----

const checkoutOptions = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await OrdersService.checkoutOptions() });
});

const placeOrder = asyncHandler(async (req, res) => {
  const data = parse(placeOrderSchema, req.body);
  res.status(201).json({ success: true, data: await OrdersService.placeOrder(data, visitSourceFrom(req)) });
});

// ---- Billing → Orders ----

const list = asyncHandler(async (req, res) => {
  const { status } = parse(listQuerySchema, req.query);
  res.json({ success: true, data: await OrdersService.list(req, { status }) });
});

const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await OrdersService.get(req.params.id, req) });
});

const updateStatus = asyncHandler(async (req, res) => {
  const data = parse(statusSchema, req.body);
  res.json({ success: true, data: await OrdersService.updateStatus(req.params.id, data, req) });
});

module.exports = { checkoutOptions, placeOrder, list, get, updateStatus };
