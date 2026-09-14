const asyncHandler = require("express-async-handler");
const CompetitionService = require("./competition.service");
const CompetitionHubService = require("./competition-hub.service");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const { createCompetitionSchema, updateCompetitionSchema } = require("./competition.validation");
const { createOfferingSchema } = require("./competition-hub.validation");

// This whole module is authorize("admin")-only (see app.js/competition.routes.js). A competition
// carries its own ownerAdminId, so ownership is a direct match, same shape as bootcamps.
function isOwn(req, competition) {
  return competition && competition.ownerAdminId === req.ownerAdminId;
}

// A hub-offering's target hub must belong to the same admin.
async function assertOwnHub(req, hubId) {
  const hubs = await LearningHubModel.findAll({ ownerAdminId: req.ownerAdminId, includeDrafts: true });
  assertOwn(hubs.some((h) => h.id === hubId));
}

const createCompetition = asyncHandler(async (req, res) => {
  const data = createCompetitionSchema.parse(req.body);
  // ownerAdminId is never client-supplied — always the creating admin's own tenant id.
  const record = await CompetitionService.createCompetition({ ...data, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: record });
});

const getAllCompetitions = asyncHandler(async (req, res) => {
  const { curriculumId, status } = req.query;
  const records = await CompetitionService.getAllCompetitions({ ownerAdminId: req.ownerAdminId, curriculumId, status });
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

const listOfferings = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await CompetitionService.getCompetitionById(req.params.id)));
  const records = await CompetitionHubService.getOfferingsForCompetition(req.params.id);
  res.json({ success: true, data: records, count: records.length });
});

const createOffering = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await CompetitionService.getCompetitionById(req.params.id)));
  const { hubId } = createOfferingSchema.parse(req.body);
  await assertOwnHub(req, hubId);
  const record = await CompetitionHubService.createOffering({ competitionId: req.params.id, hubId, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: record });
});

const deleteOffering = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await CompetitionService.getCompetitionById(req.params.id)));
  const result = await CompetitionHubService.deleteOffering(req.params.offeringId);
  res.json({ success: true, ...result });
});

module.exports = {
  createCompetition,
  getAllCompetitions,
  getCompetitionById,
  updateCompetition,
  deleteCompetition,
  listOfferings,
  createOffering,
  deleteOffering,
};
