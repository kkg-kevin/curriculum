const asyncHandler = require("express-async-handler");
const CompetitionService = require("./competition.service");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const { createCompetitionSchema, updateCompetitionSchema } = require("./competition.validation");

// This whole module is authorize("admin")-only (see app.js/competition.routes.js). A competition
// carries its own ownerAdminId, so ownership is a direct match, same shape as events.
function isOwn(req, competition) {
  return competition && competition.ownerAdminId === req.ownerAdminId;
}

const createCompetition = asyncHandler(async (req, res) => {
  const data = createCompetitionSchema.parse(req.body);
  // ownerAdminId is never client-supplied — always the creating admin's own tenant id.
  const record = await CompetitionService.createCompetition({ ...data, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: record });
});

const getAllCompetitions = asyncHandler(async (req, res) => {
  const { eventId, status } = req.query;
  const records = await CompetitionService.getAllCompetitions({ ownerAdminId: req.ownerAdminId, eventId, status });
  res.json({ success: true, data: records, count: records.length });
});

const getCompetitionById = asyncHandler(async (req, res) => {
  const record = await CompetitionService.getCompetitionById(req.params.id);
  assertOwn(isOwn(req, record));
  res.json({ success: true, data: record });
});

const updateCompetition = asyncHandler(async (req, res) => {
  const data = updateCompetitionSchema.parse(req.body);
  assertOwn(isOwn(req, await CompetitionService.getCompetitionById(req.params.id)));
  const record = await CompetitionService.updateCompetition(req.params.id, data, req.ownerAdminId);
  res.json({ success: true, data: record });
});

const deleteCompetition = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await CompetitionService.getCompetitionById(req.params.id)));
  const result = await CompetitionService.deleteCompetition(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = {
  createCompetition,
  getAllCompetitions,
  getCompetitionById,
  updateCompetition,
  deleteCompetition,
};
