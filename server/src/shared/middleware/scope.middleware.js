const asyncHandler = require("express-async-handler");
const LearningHubModel = require("../../modules/learning-hubs/learning-hub.model");
const TeacherModel = require("../../modules/teachers/teacher.model");
const LearnerModel = require("../../modules/learners/learner.model");
const CurriculumModel = require("../../modules/curriculum/curriculum.model");
const BranchModel = require("../../modules/branches/branch.model");

// Resolves the caller's own LearningHub/Teacher/Learner/Curriculum/Branch record from their JWT
// identity and attaches it to req — a "school"-role account matches against whichever learning
// hub record has that email (school is just one hub type; only school-type hubs have portal
// logins today), teacher accounts match on their own email, a learner account logs in as the
// guardian so it matches guardianEmail instead, a "curriculumAdmin" account matches whichever
// curriculum has curriculumAdminId === their own user id (mirrors class.classTeacherId — one
// outward-pointing field, not a separate collection), and a "branchAdmin" account matches
// whichever branch has branchAdminId === their own user id, same shape. Route handlers scope
// every query and ownership check off these attached records, never off client-supplied ids, so
// a role can't widen its own access by editing a query param or path param.
const attachOwnRecords = asyncHandler(async (req, res, next) => {
  const { role, email, id } = req.user;

  if (role === "school") {
    const hubs = await LearningHubModel.findAll({ email });
    req.ownSchool = hubs[0] || null;
  }

  if (role === "teacher") {
    const teachers = await TeacherModel.findAll({ email });
    req.ownTeacher = teachers[0] || null;
  }

  if (role === "learner") {
    if (req.user.username) {
      // The learner's own dedicated login (see auth.service.js's setOrCreatePasswordByUsername)
      // — resolves to exactly this one learner, never siblings, and has no concept of
      // X-Active-Learner-Id since there's only ever one to resolve to here.
      const own = await LearnerModel.findByUsername(req.user.username);
      req.ownLearner = own;
      req.ownLearners = own ? [own] : [];
    } else {
      // Guardian-owned account. A guardian can have more than one learner linked to the same
      // email (siblings) — every learner-scoped route authorizes off req.ownLearner, so the
      // client picks which one via the X-Active-Learner-Id header (see api.js's request
      // interceptor); falling back to the first when absent/invalid keeps every existing
      // single-child caller working unchanged. Never trusts the header blindly — it only ever
      // resolves to one of this guardian's own learners.
      const allLearners = await LearnerModel.findAll({ guardianEmail: email });
      req.ownLearners = allLearners;
      const requestedId = req.headers["x-active-learner-id"];
      req.ownLearner = (requestedId && allLearners.find((l) => l.id === requestedId)) || allLearners[0] || null;
    }
  }

  if (role === "curriculumAdmin") {
    const curricula = await CurriculumModel.findAll();
    req.ownCurriculum = curricula.find((c) => c.curriculumAdminId === id) || null;
  }

  if (role === "branchAdmin") {
    const branches = await BranchModel.findAll();
    req.ownBranch = branches.find((b) => b.branchAdminId === id) || null;
    // Every hub id under this branch, computed once per request — every route that used to
    // check "is this my one hub" (hubId === req.ownSchool?.id) can instead check membership in
    // this set (see isOwnHub below), covering "any hub under my branch" with the same shape.
    req.ownBranchHubIds = req.ownBranch
      ? (await LearningHubModel.findAll({ branchId: req.ownBranch.id, includeDrafts: true })).map((h) => h.id)
      : [];
  }

  next();
});

// Throws a 403 unless `condition` holds — used once a record is loaded to confirm it actually
// belongs to the caller's own scope (their school, their class, their own learner record, etc).
function assertOwn(condition) {
  if (!condition) {
    const err = new Error("You do not have permission to access this record");
    err.statusCode = 403;
    throw err;
  }
}

// True whenever `hubId` is the caller's own hub — either the exact hub a "school"-role account
// is tied to, or any hub under the branch a "branchAdmin"-role account manages. Reused across
// learning-hubs/teachers/learners/classes/attendance so a hub-scoped ownership check only needs
// one extra role to cover both. No-op (false) for every other role.
function isOwnHub(req, hubId) {
  if (!hubId) return false;
  if (req.user.role === "school") return hubId === req.ownSchool?.id;
  if (req.user.role === "branchAdmin") return !!req.ownBranchHubIds?.includes(hubId);
  return false;
}

module.exports = { attachOwnRecords, assertOwn, isOwnHub };
