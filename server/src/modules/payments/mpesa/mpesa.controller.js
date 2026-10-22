const asyncHandler = require("express-async-handler");
const MpesaService = require("./mpesa.service");
const MpesaOperations = require("./mpesa.operations");
const MpesaAccountSettings = require("./mpesa.account-settings");
const {
  initiateSchema, transactionQuerySchema, allocateSchema, ignoreSchema, reverseSchema, payoutSchema, accountSchema,
} = require("./mpesa.validation");

// These forms are filled in by parents, so a bad value comes back as one readable sentence rather
// than "Validation failed".
function parse(schema, input) {
  const result = schema.safeParse(input || {});
  if (!result.success) throw Object.assign(new Error(result.error.issues[0]?.message || "Please check the details"), { statusCode: 400 });
  return result.data;
}

const status = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaService.status(req) });
});

const initiateForInvoice = asyncHandler(async (req, res) => {
  const data = parse(initiateSchema, req.body);
  res.status(201).json({ success: true, data: await MpesaService.initiateForInvoice(req.params.id, data, req) });
});

const initiateForPendingSignup = asyncHandler(async (req, res) => {
  const data = parse(initiateSchema, req.body);
  res.status(201).json({ success: true, data: await MpesaService.initiateForPendingSignup(data, req) });
});

const getRequest = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaService.getRequest(req.params.requestId, req) });
});

const listTransactions = asyncHandler(async (req, res) => {
  const query = parse(transactionQuerySchema, req.query);
  res.json({ success: true, data: await MpesaService.listTransactions(req, query) });
});

const listFailedRequests = asyncHandler(async (req, res) => {
  const data = await MpesaService.listFailedRequests(req);
  res.json({ success: true, data, count: data.length });
});

const allocateTransaction = asyncHandler(async (req, res) => {
  const data = parse(allocateSchema, req.body);
  res.json({ success: true, data: await MpesaService.allocateTransaction(req.params.id, data, req) });
});

const ignoreTransaction = asyncHandler(async (req, res) => {
  const data = parse(ignoreSchema, req.body);
  res.json({ success: true, data: await MpesaService.ignoreTransaction(req.params.id, data, req) });
});

const checkTransaction = asyncHandler(async (req, res) => {
  res.status(202).json({ success: true, data: await MpesaOperations.checkTransaction(req.params.id, req) });
});

const reverseTransaction = asyncHandler(async (req, res) => {
  const data = parse(reverseSchema, req.body);
  res.status(202).json({ success: true, data: await MpesaOperations.reverseTransaction(req.params.id, data, req) });
});

// The statement arrives as the CSV file's text (Content-Type text/csv).
function statementText(req) {
  const text = typeof req.body === "string" ? req.body : "";
  if (!text.trim()) throw Object.assign(new Error("Choose the statement's CSV file"), { statusCode: 400 });
  return text;
}

const previewStatement = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaService.importStatement(statementText(req), { dryRun: true }, req) });
});

const importStatement = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaService.importStatement(statementText(req), { dryRun: false }, req) });
});

// ---- Paying from a link, without signing in ----

const linkSummary = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaService.linkSummary(req.params.token) });
});

const initiateForLink = asyncHandler(async (req, res) => {
  const data = parse(initiateSchema, req.body);
  res.status(201).json({ success: true, data: await MpesaService.initiateForLink(req.params.token, data) });
});

const getRequestForLink = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaService.getRequestForLink(req.params.token, req.params.requestId) });
});

// ---- Educator claims ----

const claimPayouts = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaOperations.payoutsForClaim(req.params.id, req) });
});

const payClaim = asyncHandler(async (req, res) => {
  const data = parse(payoutSchema, req.body);
  res.status(202).json({ success: true, data: await MpesaOperations.payClaim(req.params.id, data, req) });
});

// ---- Settings → Payments ----

const getAccountSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaAccountSettings.get(req) });
});

const saveAccountSettings = asyncHandler(async (req, res) => {
  const data = parse(accountSchema, req.body);
  res.json({ success: true, data: await MpesaAccountSettings.save(req, data) });
});

const removeAccountSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaAccountSettings.remove(req) });
});

const testAccountSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaAccountSettings.test(req) });
});

const registerAccountUrls = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await MpesaAccountSettings.registerUrls(req) });
});

module.exports = {
  status, initiateForInvoice, initiateForPendingSignup, getRequest, listTransactions, listFailedRequests, allocateTransaction,
  ignoreTransaction, checkTransaction, reverseTransaction, previewStatement, importStatement,
  linkSummary, initiateForLink, getRequestForLink, claimPayouts, payClaim,
  getAccountSettings, saveAccountSettings, removeAccountSettings, testAccountSettings, registerAccountUrls,
};
