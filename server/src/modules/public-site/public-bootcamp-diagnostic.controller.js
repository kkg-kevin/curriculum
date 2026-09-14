const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const PublicBootcampDiagnosticService = require("./public-bootcamp-diagnostic.service");
const { submitBootcampDiagnosticSchema } = require("./public-bootcamp-diagnostic.validation");

// Mirrors public-diagnostic.controller.js exactly (see that file's own comments) — same
// bare-object-on-GET / {ok,success,message,data}-on-POST conventions, scoped to a Bootcamp.
function hashIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || "";
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

const getDiagnostic = asyncHandler(async (req, res) => {
  const age = req.query.age != null ? Number(req.query.age) : null;
  const record = await PublicBootcampDiagnosticService.getDiagnostic(req.params.bootcampIdOrSlug, age);
  if (!record) return res.status(404).json({ message: "No public diagnostic available" });
  res.json(record);
});

const getDiagnosticAvailability = asyncHandler(async (req, res) => {
  const info = await PublicBootcampDiagnosticService.diagnosticInfo(req.params.bootcampIdOrSlug);
  res.json({ diagnosticAvailable: info.available, minAge: info.minAge, maxAge: info.maxAge });
});

const getAttemptReport = asyncHandler(async (req, res) => {
  const record = await PublicBootcampDiagnosticService.getAttemptReport(req.params.attemptId);
  if (!record) return res.status(404).json({ message: "Report not found" });
  res.json(record);
});

const submitDiagnostic = asyncHandler(async (req, res) => {
  const body = submitBootcampDiagnosticSchema.parse(req.body);
  const result = await PublicBootcampDiagnosticService.submitDiagnostic(req.params.bootcampIdOrSlug, body, hashIp(req));
  res.status(201).json({
    ok: true,
    success: true,
    message: "Here's how it went!",
    data: result,
  });
});

module.exports = { getDiagnostic, getDiagnosticAvailability, getAttemptReport, submitDiagnostic };
