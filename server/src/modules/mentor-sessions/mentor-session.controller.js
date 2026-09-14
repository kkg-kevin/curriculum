const asyncHandler = require("express-async-handler");
const MentorSessionService = require("./mentor-session.service");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const { createMentorSessionSchema, updateMentorSessionSchema } = require("./mentor-session.validation");

// This whole module is admin-only (see app.js/mentor-session.routes.js). A session carries its
// own ownerAdminId, same direct-match ownership shape as competitions/bootcamps.
function isOwn(req, session) {
  return session && session.ownerAdminId === req.ownerAdminId;
}

const createSession = asyncHandler(async (req, res) => {
  const data = createMentorSessionSchema.parse(req.body);
  // ownerAdminId is never client-supplied — always the creating admin's own tenant id.
  const record = await MentorSessionService.createSession({ ...data, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: record });
});

const getAllSessions = asyncHandler(async (req, res) => {
  const { hubId, teacherId, learnerId, paymentStatus } = req.query;
  const records = await MentorSessionService.getAllSessions({ ownerAdminId: req.ownerAdminId, hubId, teacherId, learnerId, paymentStatus });
  res.json({ success: true, data: records, count: records.length });
});

const getSessionById = asyncHandler(async (req, res) => {
  const record = await MentorSessionService.getSessionById(req.params.id);
  assertOwn(isOwn(req, record));
  res.json({ success: true, data: record });
});

const updateSession = asyncHandler(async (req, res) => {
  const data = updateMentorSessionSchema.parse(req.body);
  assertOwn(isOwn(req, await MentorSessionService.getSessionById(req.params.id)));
  const record = await MentorSessionService.updateSession(req.params.id, data, req.ownerAdminId);
  res.json({ success: true, data: record });
});

const deleteSession = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await MentorSessionService.getSessionById(req.params.id)));
  const result = await MentorSessionService.deleteSession(req.params.id);
  res.json({ success: true, ...result });
});

// Hub-scoped revenue rollup — GET /api/mentor-sessions/hub-revenue/:hubId. Ownership is checked
// against the hub itself (not a session), since a hub with zero sessions logged yet must still
// return a valid (all-zero) summary rather than 404.
const getHubRevenueSummary = asyncHandler(async (req, res) => {
  const hub = await LearningHubModel.findById(req.params.hubId);
  assertOwn(hub && hub.ownerAdminId === req.ownerAdminId);
  const summary = await MentorSessionService.getHubRevenueSummary(req.params.hubId, req.ownerAdminId);
  res.json({ success: true, data: summary });
});

module.exports = {
  createSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession,
  getHubRevenueSummary,
};
