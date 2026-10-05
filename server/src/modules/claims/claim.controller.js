const asyncHandler = require("express-async-handler");
const ClaimService = require("./claim.service");
const SupervisorService = require("./supervisor.service");
const { submitClaimSchema, decisionSchema, markPaidSchema, settingsSchema, createSupervisorSchema, updateSupervisorSchema, CLAIM_STATUSES } = require("./claim.validation");

// The educator behind this login — every educator route works off this, never off an id in the
// request.
function ownTeacher(req) {
  if (!req.ownTeacher) {
    const err = new Error("No educator profile is linked to this account");
    err.statusCode = 403;
    throw err;
  }
  return req.ownTeacher;
}

// --- Educator ---------------------------------------------------------------------------------

const getMyCourses = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await ClaimService.listMyCourses(ownTeacher(req)) });
});

const getMyCourse = asyncHandler(async (req, res) => {
  const data = await ClaimService.getCourseDetail({ teacherId: ownTeacher(req).id, classId: req.params.classId, courseId: req.params.courseId });
  res.json({ success: true, data });
});

const submitClaim = asyncHandler(async (req, res) => {
  const data = submitClaimSchema.parse(req.body);
  res.status(201).json({ success: true, data: await ClaimService.submitClaim(ownTeacher(req), data) });
});

const withdrawClaim = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await ClaimService.withdrawClaim(ownTeacher(req), req.params.id)) });
});

// --- Shared -----------------------------------------------------------------------------------

// An educator lists their own claims; a supervisor the ones sent to them; the workspace's
// reviewers all of the workspace's — the last two with a count per status.
const listClaims = asyncHandler(async (req, res) => {
  if (req.user.role === "teacher") {
    const claims = await ClaimService.listMine(ownTeacher(req));
    return res.json({ success: true, data: { claims } });
  }
  if (req.user.role === "supervisor") {
    return res.json({ success: true, data: await ClaimService.listForSupervisor(req.user.id) });
  }
  const status = CLAIM_STATUSES.includes(req.query.status) ? req.query.status : undefined;
  const data = await ClaimService.listForWorkspace(req.ownerAdminId, { status, teacherId: req.query.teacherId || undefined });
  res.json({ success: true, data });
});

// --- Reviewers --------------------------------------------------------------------------------

// The claim behind :id, if it is this caller's to see: a supervisor's own, or — for the
// workspace's reviewers — any claim in the workspace.
function reviewable(req) {
  return req.user.role === "supervisor"
    ? ClaimService.getAssigned(req.params.id, req.user.id)
    : ClaimService.getOwned(req.params.id, req.ownerAdminId);
}

const getClaim = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await ClaimService.withCourse(await reviewable(req)) });
});

// The assigned supervisor decides — the workspace can also decide in their place (a supervisor
// who is away shouldn't hold up an educator's pay).
const supervisorDecision = asyncHandler(async (req, res) => {
  const data = decisionSchema.parse(req.body);
  const claim = await ClaimService.supervisorDecision(await reviewable(req), data, await ClaimService.actorOf(req));
  res.json({ success: true, data: claim });
});

const adminDecision = asyncHandler(async (req, res) => {
  const data = decisionSchema.parse(req.body);
  const claim = await ClaimService.adminDecision(req.params.id, req.ownerAdminId, data, await ClaimService.actorOf(req));
  res.json({ success: true, data: claim });
});

const markPaid = asyncHandler(async (req, res) => {
  const data = markPaidSchema.parse(req.body || {});
  const claim = await ClaimService.markPaid(req.params.id, req.ownerAdminId, data, await ClaimService.actorOf(req));
  res.json({ success: true, data: claim });
});

const getSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await ClaimService.getSettings(req.ownerAdminId) });
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = settingsSchema.parse(req.body);
  res.json({ success: true, data: await ClaimService.saveSettings(req.ownerAdminId, data) });
});

// --- Supervisor accounts ------------------------------------------------------------------------

const listSupervisors = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await SupervisorService.list(req.ownerAdminId) });
});

const createSupervisor = asyncHandler(async (req, res) => {
  const data = createSupervisorSchema.parse(req.body);
  res.status(201).json({ success: true, data: await SupervisorService.create(req.ownerAdminId, data) });
});

const updateSupervisor = asyncHandler(async (req, res) => {
  const data = updateSupervisorSchema.parse(req.body);
  res.json({ success: true, data: await SupervisorService.update(req.params.id, req.ownerAdminId, data) });
});

const removeSupervisor = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await SupervisorService.remove(req.params.id, req.ownerAdminId)) });
});

module.exports = {
  listSupervisors, createSupervisor, updateSupervisor, removeSupervisor,
  getMyCourses, getMyCourse, submitClaim, withdrawClaim, listClaims,
  getClaim, supervisorDecision, adminDecision, markPaid, getSettings, updateSettings,
};
