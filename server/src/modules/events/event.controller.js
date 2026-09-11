const asyncHandler = require("express-async-handler");
const EventService = require("./event.service");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { createEventSchema, updateEventSchema } = require("./event.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

// This whole module is authorize("admin")-only (see app.js/event.routes.js) — no other role
// reaches it, so every check here is unconditional rather than gated behind `if (role === admin)`.
// An event has its own hubId (notNullable — see event.validation.js), so ownership is a
// direct hub-ownership check, same shape as class/room controllers' hub-scoped tables.
async function adminOwnedHubIds(req) {
  const hubs = await LearningHubModel.findAll({ ownerAdminId: req.ownerAdminId, includeDrafts: true });
  return hubs.map((h) => h.id);
}

const createEvent = asyncHandler(async (req, res) => {
  const data = createEventSchema.parse(req.body);
  assertOwn((await adminOwnedHubIds(req)).includes(data.hubId));
  const record = await EventService.createEvent(data);
  res.status(201).json({ success: true, data: record });
});

const getAllEvents = asyncHandler(async (req, res) => {
  const { curriculumId, hubId } = req.query;
  const ownHubIds = await adminOwnedHubIds(req);
  if (hubId) {
    assertOwn(ownHubIds.includes(hubId));
    const records = await EventService.getAllEvents({ curriculumId, hubId });
    return res.json({ success: true, data: records, count: records.length });
  }
  // Unbounded — an event has its own hubId, but the model filters one hub at a time (same
  // per-hub-fetch-and-merge shape as class/room controllers).
  const perHub = await Promise.all(ownHubIds.map((id) => EventService.getAllEvents({ curriculumId, hubId: id })));
  const records = perHub.flat();
  res.json({ success: true, data: records, count: records.length });
});

const getEventById = asyncHandler(async (req, res) => {
  const record = await EventService.getEventById(req.params.id);
  assertOwn((await adminOwnedHubIds(req)).includes(record.hubId));
  res.json({ success: true, data: record });
});

const updateEvent = asyncHandler(async (req, res) => {
  const data = updateEventSchema.parse(req.body);
  const existing = await EventService.getEventById(req.params.id);
  const ownHubIds = await adminOwnedHubIds(req);
  assertOwn(ownHubIds.includes(existing.hubId));
  if (data.hubId) assertOwn(ownHubIds.includes(data.hubId));
  const record = await EventService.updateEvent(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteEvent = asyncHandler(async (req, res) => {
  const existing = await EventService.getEventById(req.params.id);
  assertOwn((await adminOwnedHubIds(req)).includes(existing.hubId));
  const result = await EventService.deleteEvent(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createEvent, getAllEvents, getEventById, updateEvent, deleteEvent };
