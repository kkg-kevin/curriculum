const asyncHandler = require("express-async-handler");
const ProgramService = require("./program.service");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { createProgramSchema, updateProgramSchema } = require("./program.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

// This whole module is authorize("admin")-only (see app.js/program.routes.js) — no other role
// reaches it, so every check here is unconditional rather than gated behind `if (role === admin)`.
// A program has its own hubId (notNullable — see program.validation.js), so ownership is a
// direct hub-ownership check, same shape as class/room controllers' hub-scoped tables.
async function adminOwnedHubIds(req) {
  const hubs = await LearningHubModel.findAll({ ownerAdminId: req.ownerAdminId, includeDrafts: true });
  return hubs.map((h) => h.id);
}

const createProgram = asyncHandler(async (req, res) => {
  const data = createProgramSchema.parse(req.body);
  assertOwn((await adminOwnedHubIds(req)).includes(data.hubId));
  const record = await ProgramService.createProgram(data);
  res.status(201).json({ success: true, data: record });
});

const getAllPrograms = asyncHandler(async (req, res) => {
  const { curriculumId, hubId } = req.query;
  const ownHubIds = await adminOwnedHubIds(req);
  if (hubId) {
    assertOwn(ownHubIds.includes(hubId));
    const records = await ProgramService.getAllPrograms({ curriculumId, hubId });
    return res.json({ success: true, data: records, count: records.length });
  }
  // Unbounded — a program has its own hubId, but the model filters one hub at a time (same
  // per-hub-fetch-and-merge shape as class/room controllers).
  const perHub = await Promise.all(ownHubIds.map((id) => ProgramService.getAllPrograms({ curriculumId, hubId: id })));
  const records = perHub.flat();
  res.json({ success: true, data: records, count: records.length });
});

const getProgramById = asyncHandler(async (req, res) => {
  const record = await ProgramService.getProgramById(req.params.id);
  assertOwn((await adminOwnedHubIds(req)).includes(record.hubId));
  res.json({ success: true, data: record });
});

const updateProgram = asyncHandler(async (req, res) => {
  const data = updateProgramSchema.parse(req.body);
  const existing = await ProgramService.getProgramById(req.params.id);
  const ownHubIds = await adminOwnedHubIds(req);
  assertOwn(ownHubIds.includes(existing.hubId));
  if (data.hubId) assertOwn(ownHubIds.includes(data.hubId));
  const record = await ProgramService.updateProgram(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteProgram = asyncHandler(async (req, res) => {
  const existing = await ProgramService.getProgramById(req.params.id);
  assertOwn((await adminOwnedHubIds(req)).includes(existing.hubId));
  const result = await ProgramService.deleteProgram(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createProgram, getAllPrograms, getProgramById, updateProgram, deleteProgram };
