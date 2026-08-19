const asyncHandler = require("express-async-handler");
const LearnerService = require("./learner.service");
const LearnerModel = require("./learner.model");
const AuthService = require("../auth/auth.service");
const LearnerHubLinkModel = require("./learner-hub-link.model");
const { createLearnerSchema, updateLearnerSchema, enrollLearnerSchema, updateEnrollmentSchema, transferHubSchema } = require("./learner.validation");
const { assertOwn, isOwnHub } = require("../../shared/middleware/scope.middleware");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");

// A learner belongs to a class, and a class has zero or more course-educator links — this is the
// only place a teacher's access to a learner is decided, so both getAllLearners and
// getLearnerById go through it.
async function classTaughtByTeacher(classId, teacherId) {
  if (!classId) return false;
  const links = await ClassCourseTeacherLinkModel.findByClassId(classId);
  return links.some((l) => l.teacherId === teacherId);
}

// True whenever `learnerId` has an enrollment link at `hubId` — the membership test a
// "school"-role caller needs to prove a learner belongs to its own hub. Same pattern as
// teacher.controller.js's `isLinkedToHub`.
async function isLinkedToHub(learnerId, hubId) {
  const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
  return links.some((l) => l.hubId === hubId);
}

// Same membership test, but for a caller that may own more than one hub — a "school" account's
// one hub, or every hub under a "branchAdmin" account's branch.
async function isLinkedToOwnHub(req, learnerId) {
  if (req.user.role === "school") return isLinkedToHub(learnerId, req.ownSchool?.id);
  if (req.user.role === "branchAdmin") {
    if (!req.ownBranchHubIds?.length) return false;
    const results = await Promise.all(req.ownBranchHubIds.map((hubId) => isLinkedToHub(learnerId, hubId)));
    return results.some(Boolean);
  }
  return false;
}

// True whenever any of `learnerId`'s enrollment links puts them in a class this teacher
// teaches — a learner can now have several enrollments, so this is an "any", not the old
// single-classId equality check.
async function anyEnrollmentTaughtByTeacher(learnerId, teacherId) {
  const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
  const results = await Promise.all(links.map((l) => classTaughtByTeacher(l.classId, teacherId)));
  return results.some(Boolean);
}

const createLearner = asyncHandler(async (req, res) => {
  const { hubId, classId } = req.body;
  const { password, learnerPassword, ...data } = createLearnerSchema.parse(req.body);
  // Create the login first — if it fails (e.g. the email already belongs to a different-role
  // account), nothing is written at all, rather than leaving a learner record with no login.
  if (password) {
    await AuthService.setOrCreatePassword({ name: data.guardianName, email: data.guardianEmail, password, role: "learner" });
  }
  const record = await LearnerService.createLearner(data);
  // The learner's OWN dedicated login is minted only after the record — createLearner's own
  // username-uniqueness check (assertUsernameAvailable) has to throw first, so a colliding/
  // typo'd username can never silently reset a different learner's own login before this
  // record is even confirmed valid.
  if (learnerPassword) {
    await AuthService.setOrCreatePasswordByUsername({
      name: `${record.firstName} ${record.lastName}`.trim(),
      username: record.username,
      password: learnerPassword,
      role: "learner",
    });
  }
  // A learner is never linked to a hub as part of its own identity — hubId here is purely an
  // optional one-shot convenience (e.g. "Enroll Learner" clicked from within a school's own
  // page), a second write after the learner already exists, same as createTeacher.
  let linkHubId = hubId || undefined;
  if (req.user.role === "school") linkHubId = req.ownSchool?.id;
  else if (req.user.role === "branchAdmin" && linkHubId) assertOwn(isOwnHub(req, linkHubId));
  if (linkHubId) await LearnerService.enrollInHub(record.id, { hubId: linkHubId, classId: classId || "", status: "active" });
  res.status(201).json({ success: true, data: record });
});

const getAllLearners = asyncHandler(async (req, res) => {
  const { schoolId, classId, status, guardianEmail, q } = req.query;
  // Cross-hub search by name, username, or registration number — how a school/branchAdmin
  // finds a learner already enrolled at a DIFFERENT hub, in order to also enroll them at this
  // one (see AddExistingLearnerPanel on the client). Deliberately bypasses every hub-scoping
  // filter below, since the whole point is finding someone outside it; gated to roles that
  // already manage enrollment (never teacher/learner, which would otherwise gain arbitrary
  // cross-learner lookup). Returns only a hubCount per match, never the other hub's identity —
  // same privacy shape as the unscoped cross-hub branch in LearnerService.getAllLearners.
  if (q && q.trim() && ["admin", "school", "branchAdmin"].includes(req.user.role)) {
    const records = await LearnerModel.search(q);
    const data = await Promise.all(records.map(async (record) => ({
      ...record,
      hubCount: (await LearnerHubLinkModel.findByLearnerId(record.id)).length,
    })));
    return res.json({ success: true, data, count: data.length });
  }
  const filters = { schoolId, classId, status, guardianEmail };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.schoolId = req.ownSchool.id;
  } else if (req.user.role === "branchAdmin") {
    if (!req.ownBranch) return res.json({ success: true, data: [], count: 0 });
    // LearnerService resolves enrollment per-hub internally (see its getAllLearners comment) —
    // call it once per hub in the branch and merge, rather than re-deriving that link-merge logic.
    const perHub = await Promise.all(req.ownBranchHubIds.map((hubId) => LearnerService.getAllLearners({ ...filters, schoolId: hubId })));
    const records = perHub.flat();
    return res.json({ success: true, data: records, count: records.length });
  } else if (req.user.role === "teacher") {
    if (!req.ownTeacher || !(await classTaughtByTeacher(classId, req.ownTeacher.id))) {
      return res.json({ success: true, data: [], count: 0 });
    }
  } else if (req.user.role === "learner") {
    if (!req.ownLearner) return res.json({ success: true, data: [], count: 0 });
    // The learner's own dedicated login only ever sees itself, never siblings — the
    // guardian-mediated login is the one that broadens to every learner sharing its email
    // (see the sibling-switcher this feeds in the learner-portal).
    if (req.user.username) filters.ids = [req.ownLearner.id];
    else filters.guardianEmail = req.ownLearner.guardianEmail;
  }
  const records = await LearnerService.getAllLearners(filters);
  res.json({ success: true, data: records, count: records.length });
});

const getLearnerById = asyncHandler(async (req, res) => {
  const record = await LearnerService.getLearnerById(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(await isLinkedToOwnHub(req, record.id));
  if (req.user.role === "teacher") assertOwn(await anyEnrollmentTaughtByTeacher(record.id, req.ownTeacher?.id));
  if (req.user.role === "learner") assertOwn(record.id === req.ownLearner?.id);
  res.json({ success: true, data: record });
});

// Self-service fields the learner's OWN dedicated login (as opposed to the guardian-mediated
// one) may change on the record — deliberately excludes guardianName/guardianPhone/
// guardianEmail: those are the GUARDIAN's own profile, edited only from the guardian's login.
// The guardian's own `password` is likewise never honored from this login (see below) — only
// `learnerPassword`, the learner's own credential, ever is.
const LEARNER_SELF_EDIT_FIELDS = ["firstName", "lastName", "gender", "dateOfBirth", "nationality", "languages", "photo", "username"];

const updateLearner = asyncHandler(async (req, res) => {
  const { password, learnerPassword, ...parsed } = updateLearnerSchema.parse(req.body);
  // .partial() still applies each field's .default() when it's absent from the request body
  // (currentRungId defaults to null) — without this filter, a PUT that only sends identity
  // fields (e.g. the learner-portal profile edit form) would silently wipe whatever placement a
  // teacher/admin had already set. Only keys the caller actually sent survive.
  const data = Object.fromEntries(Object.entries(parsed).filter(([key]) => key in req.body));
  // Fetched unconditionally (not just for school/branchAdmin) — the username-rename sync below
  // needs the pre-update value regardless of who's making the change.
  const before = await LearnerService.getLearnerById(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") {
    assertOwn(await isLinkedToOwnHub(req, before.id));
  }
  // A learner's own dedicated login may only touch its own identity fields + its own login
  // password — guardian contact info and the guardian's own password stay guardian-login-only,
  // enforced here (not just hidden client-side) since a determined caller could otherwise still
  // PUT those fields directly. The guardian-mediated login (req.user.username absent) keeps full
  // write access to everything, exactly as before this change.
  let allowGuardianPassword = true;
  if (req.user.role === "learner") {
    // "learner" (either login) may only ever update its own linked record — the learner-portal
    // profile edit form, never an arbitrary id.
    assertOwn(req.params.id === req.ownLearner?.id);
    if (req.user.username) {
      Object.keys(data).forEach((key) => { if (!LEARNER_SELF_EDIT_FIELDS.includes(key)) delete data[key]; });
      allowGuardianPassword = false;
    }
  }
  const record = await LearnerService.updateLearner(req.params.id, data);
  if (password && allowGuardianPassword) {
    if (!record.guardianEmail) {
      const err = new Error("This learner needs a guardian email before a password can be set");
      err.statusCode = 400;
      throw err;
    }
    await AuthService.setOrCreatePassword({ name: record.guardianName, email: record.guardianEmail, password, role: "learner" });
  }
  // Keeps the learner's own dedicated login (if any) attached to their current username when
  // it's renamed — otherwise it'd still work but silently become unreachable under the old one.
  if ("username" in data && before.username && before.username !== data.username) {
    await AuthService.renameUsernameAccount(before.username, data.username || null);
  }
  if (learnerPassword) {
    if (!record.username) {
      const err = new Error("This learner needs a username before a learner-portal password can be set");
      err.statusCode = 400;
      throw err;
    }
    await AuthService.setOrCreatePasswordByUsername({
      name: `${record.firstName} ${record.lastName}`.trim(),
      username: record.username,
      password: learnerPassword,
      role: "learner",
    });
  }
  res.json({ success: true, data: record });
});

// True delete is admin-only (see learner.routes.js) — a "school" losing access to a learner
// shared with another hub must unenroll (DELETE /:id/hubs/links/:hubId), never destroy the
// underlying record, same split as teacher.controller.js.
const deleteLearner = asyncHandler(async (req, res) => {
  const result = await LearnerService.deleteLearner(req.params.id);
  res.json({ success: true, ...result });
});

const getLearnerHubs = asyncHandler(async (req, res) => {
  if (req.user.role === "learner") assertOwn(req.params.id === req.ownLearner?.id);
  let hubs = await LearnerService.getLearnerHubs(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") {
    assertOwn(await isLinkedToOwnHub(req, req.params.id));
    // A school/branchAdmin only ever gets to see its own hub(s) in the list — not the names of
    // any other hub a shared learner also happens to attend.
    hubs = hubs.filter((h) => isOwnHub(req, h.id));
  } else if (req.user.role === "teacher") {
    assertOwn(await anyEnrollmentTaughtByTeacher(req.params.id, req.ownTeacher?.id));
  }
  res.json({ success: true, data: hubs, count: hubs.length });
});

const enrollLearnerHub = asyncHandler(async (req, res) => {
  const data = enrollLearnerSchema.parse(req.body);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, data.hubId));
  const hubs = await LearnerService.enrollInHub(req.params.id, data);
  res.status(201).json({ success: true, data: hubs });
});

const updateLearnerHubLink = asyncHandler(async (req, res) => {
  const data = updateEnrollmentSchema.parse(req.body);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, req.params.hubId));
  const hubs = await LearnerService.updateEnrollment(req.params.id, req.params.hubId, data);
  res.json({ success: true, data: hubs });
});

const unenrollLearnerHub = asyncHandler(async (req, res) => {
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, req.params.hubId));
  const hubs = await LearnerService.unenrollFromHub(req.params.id, req.params.hubId);
  res.json({ success: true, data: hubs });
});

// Moves a learner from the hub in the URL (:hubId) to another hub in one action. Only the
// SOURCE hub needs to be the caller's own — same posture as "Add Existing Learner", which
// already lets a school/branchAdmin enroll a learner from any other hub into theirs without that
// other hub's permission, so requiring ownership of the destination too would be inconsistent.
const transferLearnerHub = asyncHandler(async (req, res) => {
  const { toHubId, toClassId } = transferHubSchema.parse(req.body);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, req.params.hubId));
  const hubs = await LearnerService.transferHub(req.params.id, {
    fromHubId: req.params.hubId, toHubId, toClassId, transferredBy: req.user.id,
  });
  res.json({ success: true, data: hubs });
});

// Learner-portal-only: fired once from the first-login diagnostic gate before it reads this
// learner's Learning-Area diagnostics, so an enrollment whose issuance was missed/incomplete
// still gets caught before the gate decides there's nothing to show.
const ensureDiagnosticsIssued = asyncHandler(async (req, res) => {
  assertOwn(req.params.id === req.ownLearner?.id);
  const { hubId } = req.body;
  if (!hubId) {
    const err = new Error("hubId is required");
    err.statusCode = 400;
    throw err;
  }
  await LearnerService.ensureDiagnosticsIssued(req.params.id, hubId);
  res.json({ success: true });
});

// Learner-portal-only: fired once the first-login diagnostic gate has nothing left
// outstanding for this hub. Deliberately its own narrow endpoint rather than reusing
// updateLearnerHubLink — that route also allows changing classId/status, which a learner must
// never be able to do to their own enrollment.
const completeHubOnboarding = asyncHandler(async (req, res) => {
  assertOwn(req.params.id === req.ownLearner?.id);
  const hub = await LearnerService.markHubOnboardingComplete(req.params.id, req.params.hubId);
  res.json({ success: true, data: hub });
});

// Get-or-create the "share via QR" token — same ownership scoping as updateLearner (a
// school/branchAdmin may only mint a share link for a learner actually linked to a hub they
// own; admin is unrestricted). A "learner" login (guardian-mediated or the learner's own
// dedicated one — either way req.ownLearner resolves to this same record, see
// scope.middleware.js) may only ever mint its own link, mirroring ensureDiagnosticsIssued's
// self-only scoping below. The token itself never appears anywhere but this response and the
// public read below.
const getPublicToken = asyncHandler(async (req, res) => {
  const record = await LearnerService.getLearnerById(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") {
    assertOwn(await isLinkedToOwnHub(req, record.id));
  } else if (req.user.role === "learner") {
    assertOwn(req.params.id === req.ownLearner?.id);
  }
  const token = await LearnerService.getOrCreatePublicToken(req.params.id);
  res.json({ success: true, data: { token } });
});

// Same scoping as getPublicToken — invalidates whatever's currently printed/shared and hands
// back a fresh one.
const regeneratePublicToken = asyncHandler(async (req, res) => {
  const record = await LearnerService.getLearnerById(req.params.id);
  if (req.user.role === "school" || req.user.role === "branchAdmin") {
    assertOwn(await isLinkedToOwnHub(req, record.id));
  } else if (req.user.role === "learner") {
    assertOwn(req.params.id === req.ownLearner?.id);
  }
  const token = await LearnerService.regeneratePublicToken(req.params.id);
  res.json({ success: true, data: { token } });
});

// Unauthenticated — mounted separately in app.js, ahead of the `protect` middleware chain that
// guards every other /api/learners route (see public-profile.routes.js). No req.user, no
// ownership check: the token itself IS the access control.
const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await LearnerService.getPublicProfile(req.params.token);
  res.json({ success: true, data: profile });
});

module.exports = {
  createLearner,
  getAllLearners,
  getLearnerById,
  updateLearner,
  deleteLearner,
  getLearnerHubs,
  enrollLearnerHub,
  updateLearnerHubLink,
  unenrollLearnerHub,
  transferLearnerHub,
  ensureDiagnosticsIssued,
  completeHubOnboarding,
  getPublicToken,
  regeneratePublicToken,
  getPublicProfile,
};
