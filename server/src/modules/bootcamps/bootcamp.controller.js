const asyncHandler = require("express-async-handler");
const BootcampService = require("./bootcamp.service");
const BootcampHubService = require("./bootcamp-hub.service");
const BootcampParticipantsService = require("./bootcamp-participants.service");
const BootcampReturningService = require("./bootcamp-returning.service");
const { z } = require("zod");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const { createBootcampSchema, updateBootcampSchema, scheduleRunSchema } = require("./bootcamp.validation");
const { createOfferingSchema } = require("./bootcamp-hub.validation");
const { parsePatch } = require("../../shared/validators/common.validator");
const UsageService = require("../usage/usage.service");

// This whole module is authorize("admin")-only (see app.js/bootcamp.routes.js). A bootcamp
// carries its own ownerAdminId, so ownership is a direct match, same shape as competitions.
function isOwn(req, bootcamp) {
  return bootcamp && bootcamp.ownerAdminId === req.ownerAdminId;
}

// A hub-offering's target hub must belong to the same admin — mirrors the old event.controller.js's
// adminOwnedHubIds check for Event deployments.
async function assertOwnHub(req, hubId) {
  const hubs = await LearningHubModel.findAll({ ownerAdminId: req.ownerAdminId, includeDrafts: true });
  assertOwn(hubs.some((h) => h.id === hubId));
}

const createBootcamp = asyncHandler(async (req, res) => {
  const data = createBootcampSchema.parse(req.body);
  // ownerAdminId is never client-supplied — always the creating admin's own tenant id.
  const record = await BootcampService.createBootcamp({ ...data, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: record });
});

const getAllBootcamps = asyncHandler(async (req, res) => {
  const { curriculumId, saleStatus } = req.query;
  // ?audience=educators — only the TOT (training of trainers) bootcamps; learners — only the rest.
  const audience = ["learners", "educators"].includes(req.query.audience) ? req.query.audience : undefined;
  const records = await BootcampService.getAllBootcamps({ ownerAdminId: req.ownerAdminId, curriculumId, saleStatus, audience });
  res.json({ success: true, data: records, count: records.length });
});

const getBootcampById = asyncHandler(async (req, res) => {
  const record = await BootcampService.getBootcampById(req.params.id);
  assertOwn(isOwn(req, record));
  res.json({ success: true, data: record });
});

const updateBootcamp = asyncHandler(async (req, res) => {
  // Only the fields that were sent — "Publish to website" patches saleStatus alone, and must not
  // reset the description, dates, highlights and pricing to their defaults (see parsePatch).
  const data = parsePatch(updateBootcampSchema, req.body);
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  const record = await BootcampService.updateBootcamp(req.params.id, data, req.ownerAdminId);
  res.json({ success: true, data: record });
});

const deleteBootcamp = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  if (await UsageService.guardDelete(req, res, "bootcamp", req.params.id, "This bootcamp")) return;
  const result = await BootcampService.deleteBootcamp(req.params.id);
  res.json({ success: true, ...result });
});

// Every run of this bootcamp, and scheduling another (a copy with new dates — see
// BootcampService.scheduleRun). The hubs picked for the new run must be this admin's own.
const listRuns = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  res.json({ success: true, data: await BootcampService.listRuns(req.params.id) });
});

const scheduleRun = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  const data = scheduleRunSchema.parse(req.body);
  for (const hubId of data.hubIds) await assertOwnHub(req, hubId);
  const result = await BootcampService.scheduleRun(req.params.id, data, req.ownerAdminId);
  res.status(201).json({ success: true, data: result });
});

// The learners and parents who took part — this run, or every run of the bootcamp (?scope=series).
const listParticipants = asyncHandler(async (req, res) => {
  const bootcamp = await BootcampService.getBootcampById(req.params.id);
  assertOwn(isOwn(req, bootcamp));
  const scope = req.query.scope === "series" ? "series" : "run";
  res.json({ success: true, data: await BootcampParticipantsService.list(bootcamp, { scope }) });
});

const listOfferings = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  const records = await BootcampHubService.getOfferingsForBootcamp(req.params.id);
  res.json({ success: true, data: records, count: records.length });
});

const createOffering = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  const { hubId } = createOfferingSchema.parse(req.body);
  await assertOwnHub(req, hubId);
  const record = await BootcampHubService.createOffering({ bootcampId: req.params.id, hubId, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: record });
});

const deleteOffering = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  const result = await BootcampHubService.deleteOffering(req.params.offeringId);
  res.json({ success: true, ...result });
});

// A cohort added to the curriculum after the hub was added gets its class here (27 Nov 2026).
const addMissingClasses = asyncHandler(async (req, res) => {
  assertOwn(isOwn(req, await BootcampService.getBootcampById(req.params.id)));
  res.status(201).json({ success: true, data: await BootcampHubService.addMissingClasses(req.params.offeringId, req.params.id) });
});

// Bringing learners of earlier runs back into this one (bootcamp-returning.service.js). Moving a
// learner is Learners → Edit for staff too, as on the learner page's Move learner.
function assertMayMoveLearners(req) {
  if (req.user?.actualRole !== "collaborator") return;
  const { can } = require("../access/access.service");
  if (!can(req.user.permissions, "learners", "edit")) {
    throw Object.assign(new Error("Your role doesn't allow you to move learners (Learners → Edit)."), { statusCode: 403 });
  }
}

const listReturning = asyncHandler(async (req, res) => {
  const bootcamp = await BootcampService.getBootcampById(req.params.id);
  assertOwn(isOwn(req, bootcamp));
  res.json({ success: true, data: await BootcampReturningService.candidates(bootcamp) });
});

const id = z.string().trim().min(1).max(64);
const bringBackSchema = z.object({
  hubId: id,
  learnerIds: z.array(id).min(1, "Tick the learners to bring back").max(200),
  classId: id.optional().nullable().or(z.literal("")),
  invoice: z.boolean().optional(),
  notifyParent: z.boolean().optional(),
  leaveEarlierPlace: z.boolean().optional(),
});

const bringBack = asyncHandler(async (req, res) => {
  assertMayMoveLearners(req);
  const bootcamp = await BootcampService.getBootcampById(req.params.id);
  assertOwn(isOwn(req, bootcamp));
  const parsed = bringBackSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Check the details" });
  await assertOwnHub(req, parsed.data.hubId);
  const data = { ...parsed.data, classId: parsed.data.classId || null };
  res.status(201).json({ success: true, data: await BootcampReturningService.bringBack(req, bootcamp, data) });
});

module.exports = {
  addMissingClasses,
  listReturning,
  bringBack,
  createBootcamp,
  getAllBootcamps,
  getBootcampById,
  updateBootcamp,
  deleteBootcamp,
  listRuns,
  scheduleRun,
  listParticipants,
  listOfferings,
  createOffering,
  deleteOffering,
};
