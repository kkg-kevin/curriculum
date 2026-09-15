const asyncHandler = require("express-async-handler");
const HubVisitService = require("./hub-visit.service");
const { logVisitSchema, updateVisitSchema, generateChargesPreviewSchema, generateChargesSchema } = require("./hub-visit.validation");

const logVisit = asyncHandler(async (req, res) => {
  const data = logVisitSchema.parse(req.body);
  res.status(201).json({ success: true, data: await HubVisitService.logVisit(data, req) });
});

const listVisits = asyncHandler(async (req, res) => {
  const { hubId, learnerId, spaceId, billingStatus, from, to } = req.query;
  const data = await HubVisitService.listVisits({ hubId, learnerId, spaceId, billingStatus, from, to }, req);
  res.json({ success: true, data, count: data.length });
});

const getVisit = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HubVisitService.getVisit(req.params.id, req) });
});

const updateVisit = asyncHandler(async (req, res) => {
  const data = updateVisitSchema.parse(req.body);
  res.json({ success: true, data: await HubVisitService.updateVisit(req.params.id, data, req) });
});

const deleteVisit = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HubVisitService.deleteVisit(req.params.id, req) });
});

const previewGenerateCharges = asyncHandler(async (req, res) => {
  const data = generateChargesPreviewSchema.parse({ ...req.body, hubId: req.params.hubId });
  res.json({ success: true, data: await HubVisitService.previewGenerateCharges(data, req) });
});

const generateCharges = asyncHandler(async (req, res) => {
  const data = generateChargesSchema.parse({ ...req.body, hubId: req.params.hubId });
  res.status(201).json({ success: true, data: await HubVisitService.generateCharges(data, req) });
});

const getHubRevenueSummary = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HubVisitService.getHubRevenueSummary(req.params.hubId, req) });
});

const getAllHubsRevenueSummary = asyncHandler(async (req, res) => {
  const data = await HubVisitService.getAllHubsRevenueSummary(req);
  res.json({ success: true, data, count: data.length });
});

module.exports = { logVisit, listVisits, getVisit, updateVisit, deleteVisit, previewGenerateCharges, generateCharges, getHubRevenueSummary, getAllHubsRevenueSummary };
