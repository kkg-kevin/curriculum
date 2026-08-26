const asyncHandler = require("express-async-handler");
const BillingService = require("./billing.service");
const { createInvoiceSchema, updateInvoiceSchema, recordPaymentSchema, bulkInvoicePreviewSchema, bulkInvoiceCreateSchema, statementQuerySchema } = require("./billing.validation");

const listBatches = asyncHandler(async (req, res) => {
  const data = await BillingService.listBatches(req);
  res.json({ success: true, data, count: data.length });
});

const previewBulkInvoices = asyncHandler(async (req, res) => {
  const data = bulkInvoicePreviewSchema.parse(req.body);
  res.json({ success: true, data: await BillingService.previewBulkInvoices(data, req) });
});

const createBulkInvoices = asyncHandler(async (req, res) => {
  const data = bulkInvoiceCreateSchema.parse(req.body);
  res.status(201).json({ success: true, data: await BillingService.createBulkInvoices(data, req) });
});

const listInvoices = asyncHandler(async (req, res) => {
  const data = await BillingService.listInvoices(req);
  res.json({ success: true, data, count: data.length });
});

const getInvoice = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await BillingService.getInvoice(req.params.id, req) });
});

const createInvoice = asyncHandler(async (req, res) => {
  const data = createInvoiceSchema.parse(req.body);
  res.status(201).json({ success: true, data: await BillingService.createInvoice(data, req) });
});

const updateInvoice = asyncHandler(async (req, res) => {
  const data = updateInvoiceSchema.parse(req.body);
  res.json({ success: true, data: await BillingService.updateInvoice(req.params.id, data, req) });
});

const issueInvoice = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await BillingService.issueInvoice(req.params.id, req) });
});

const cancelInvoice = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await BillingService.cancelInvoice(req.params.id, req) });
});

const recordPayment = asyncHandler(async (req, res) => {
  const data = recordPaymentSchema.parse(req.body);
  res.json({ success: true, data: await BillingService.recordPayment(req.params.id, data, req) });
});

const listReceipts = asyncHandler(async (req, res) => {
  const data = await BillingService.listReceipts(req);
  res.json({ success: true, data, count: data.length });
});

const getReceipt = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await BillingService.getReceipt(req.params.invoiceId, req.params.paymentId, req) });
});

const getStatement = asyncHandler(async (req, res) => {
  const query = statementQuerySchema.parse(req.query);
  res.json({ success: true, data: await BillingService.getStatement(req.params.payerType, req.params.payerId, query, req) });
});

module.exports = { listInvoices, getInvoice, createInvoice, updateInvoice, issueInvoice, cancelInvoice, recordPayment, listBatches, previewBulkInvoices, createBulkInvoices, listReceipts, getReceipt, getStatement };
