const asyncHandler = require("express-async-handler");
const ClaimService = require("./claim.service");
const { submitClaimSchema, decisionSchema, markPaidSchema, settingsSchema, CLAIM_STATUSES } = require("./claim.validation");

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

// An educator lists their own claims; a reviewer lists the workspace's, with a count per status.
const listClaims = asyncHandler(async (req, res) => {
  if (req.user.role === "teacher") {
    const claims = await ClaimService.listMine(ownTeacher(req));
    return res.json({ success: true, data: { claims } });
  }
  const status = CLAIM_STATUSES.includes(req.query.status) ? req.query.status : undefined;
  const data = await ClaimService.listForWorkspace(req.ownerAdminId, { status, teacherId: req.query.teacherId || undefined });
  res.json({ success: true, data });
});

// --- Reviewers --------------------------------------------------------------------------------

const getClaim = asyncHandler(async (req, res) => {
  const claim = await ClaimService.getOwned(req.params.id, req.ownerAdminId);
  res.json({ success: true, data: await ClaimService.withCourse(claim) });
});

const supervisorDecision = asyncHandler(async (req, res) => {
  const data = decisionSchema.parse(req.body);
  const claim = await ClaimService.supervisorDecision(req.params.id, req.ownerAdminId, data, await ClaimService.actorOf(req));
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

module.exports = {
  getMyCourses, getMyCourse, submitClaim, withdrawClaim, listClaims,
  getClaim, supervisorDecision, adminDecision, markPaid, getSettings, updateSettings,
};
