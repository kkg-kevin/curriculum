const asyncHandler = require("express-async-handler");
const BootcampService = require("./bootcamp.service");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const { createBootcampSchema, updateBootcampSchema } = require("./bootcamp.validation");

// This whole module is authorize("admin")-only (see app.js/bootcamp.routes.js). A bootcamp
// carries its own ownerAdminId, so ownership is a direct match, same shape as competitions.
function isOwn(req, bootcamp) {
  return bootcamp && bootcamp.ownerAdminId === req.ownerAdminId;
}

const createBootcamp = asyncHandler(async (req, res) => {
  const data = createBootcampSchema.parse(req.body);
  // ownerAdminId is never client-supplied — always the creating admin's own tenant id.
  const record = await BootcampService.createBootcamp({ ...data, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: record });
});

const getAllBootcamps = asyncHandler(async (req, res) => {
  const { eventId, saleStatus } = req.query;
  const records = await BootcampService.getAllBootcamps({ ownerAdminId: req.ownerAdminId, eventId, saleStatus });
  res.json({ success: true, data: records, count: records.length });
});

const getBootcampById = asyncHandler(async (req, res) => {
  const record = await BootcampService.getBootcampById(req.params.id);
  assertOwn(isOwn(req, record));
  res.json({ success: true, data: record });
});

const updateBootcamp = asyncHandler(async (req, res) => {
  const data = updateBootcampSchema.parse(req.body);
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  const record = await BootcampService.updateBootcamp(req.params.id, data, req.ownerAdminId);
  res.json({ success: true, data: record });
});

const deleteBootcamp = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  const result = await BootcampService.deleteBootcamp(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = {
  createBootcamp,
  getAllBootcamps,
  getBootcampById,
  updateBootcamp,
  deleteBootcamp,
};
