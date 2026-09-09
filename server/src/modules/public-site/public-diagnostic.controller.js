const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const PublicDiagnosticService = require("./public-diagnostic.service");
const { submitDiagnosticSchema } = require("./public-diagnostic.validation");

// Never store/log a raw IP — a one-way hash is enough for "one IP, many attempts" abuse
// visibility (public_diagnostic_attempts.ipHash) without keeping anything that identifies a
// specific visitor on its own.
function hashIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || "";
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// Bare-object responses on GET, no { success, data } wrapper — matches
// public-site.controller.js's existing convention exactly (see Guide/WEBSITE_INTEGRATION_CONTRACT.md).
const getDiagnostic = asyncHandler(async (req, res) => {
  const age = req.query.age != null ? Number(req.query.age) : null;
  const record = await PublicDiagnosticService.getDiagnostic(req.params.pathwayIdOrSlug, age);
  if (!record) return res.status(404).json({ message: "No public diagnostic available" });
  res.json(record);
});

// Availability + age range for the pathway detail page's CTA — same bare-object convention.
// `diagnosticAvailable` kept for back-compat; `minAge`/`maxAge` are new (null when unavailable).
const getDiagnosticAvailability = asyncHandler(async (req, res) => {
  const info = await PublicDiagnosticService.diagnosticInfo(req.params.pathwayIdOrSlug);
  res.json({ diagnosticAvailable: info.available, minAge: info.minAge, maxAge: info.maxAge });
});

// The permanent shareable report link — GET /api/public/diagnostics/attempts/:attemptId. Bare
// object, same convention as the reads above. `:attemptId` is the opaque uuid the submit
// response returned; unknown/garbage id → 404, deliberately the same message shape as the
// question-set endpoint so the two aren't distinguishable to a probing client.
const getAttemptReport = asyncHandler(async (req, res) => {
  const record = await PublicDiagnosticService.getAttemptReport(req.params.attemptId);
  if (!record) return res.status(404).json({ message: "Report not found" });
  res.json(record);
});

// { ok, success, message, data } wrapper on POST — matches lead.controller.js's existing two
// POSTs exactly. `data` carries the graded report (score, indicatorBreakdown, per-item results)
// so the website can render the report from this one response, no second round-trip.
const submitDiagnostic = asyncHandler(async (req, res) => {
  const body = submitDiagnosticSchema.parse(req.body);
  const result = await PublicDiagnosticService.submitDiagnostic(req.params.pathwayIdOrSlug, body, hashIp(req));
  res.status(201).json({
    ok: true,
    success: true,
    message: "Here's how it went!",
    data: result,
  });
});

module.exports = { getDiagnostic, getDiagnosticAvailability, getAttemptReport, submitDiagnostic };
