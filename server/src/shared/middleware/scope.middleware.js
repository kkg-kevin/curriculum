const asyncHandler = require("express-async-handler");
const LearningHubModel = require("../../modules/learning-hubs/learning-hub.model");
const TeacherModel = require("../../modules/teachers/teacher.model");
const LearnerModel = require("../../modules/learners/learner.model");
const CurriculumModel = require("../../modules/curriculum/curriculum.model");

// Resolves the caller's own LearningHub/Teacher/Learner/Curriculum record from their JWT
// identity and attaches it to req — a "school"-role account matches against whichever learning
// hub record has that email (school is just one hub type; only school-type hubs have portal
// logins today), teacher accounts match on their own email, a learner account logs in as the
// guardian so it matches guardianEmail instead, and a "curriculumAdmin" account matches whichever
// curriculum has curriculumAdminId === their own user id (mirrors class.classTeacherId — one
// outward-pointing field, not a separate collection). Route handlers scope every query and
// ownership check off these attached records, never off client-supplied ids, so a role can't
// widen its own access by editing a query param or path param.
const attachOwnRecords = asyncHandler(async (req, res, next) => {
  const { role, email, id } = req.user;

  if (role === "school") {
    // A hub can itself be the parent of other hubs (its "branches") — the parent's own admin
    // gets access to switch into each one, exactly like a guardian switching between linked
    // learners below: req.ownSchools is every hub this login can act as (own hub first, then its
    // branches), req.ownSchool is whichever ONE is currently active, chosen via the
    // X-Active-Hub-Id header (see api.js's request interceptor) and validated by finding it in
    // req.ownSchools — never trusts the header blindly, falls back to the login's own hub.
    const hubs = await LearningHubModel.findAll({ email, includeDrafts: true });
    const ownHub = hubs.find((h) => !h.parentHubId) || hubs[0] || null;
    if (ownHub) {
      if (ownHub.status === "inactive") {
        const err = new Error("This learning hub account is inactive");
        err.statusCode = 403;
        throw err;
      }
      const branches = await LearningHubModel.findAll({ parentHubId: ownHub.id, includeDrafts: true });
      req.ownSchools = [ownHub, ...branches.filter((h) => h.status !== "inactive")];
      const requestedId = req.headers["x-active-hub-id"];
      req.ownSchool = (requestedId && req.ownSchools.find((h) => h.id === requestedId)) || ownHub;
    } else {
      req.ownSchools = [];
      req.ownSchool = null;
    }
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
      if (!own || (own.accountStatus || "active") !== "active") {
        const err = new Error("This learner account is inactive");
        err.statusCode = 403;
        throw err;
      }
      req.ownLearner = own;
      req.ownLearners = [own];
    } else {
      // Guardian-owned account. A guardian can have more than one learner linked to the same
      // email (siblings) — every learner-scoped route authorizes off req.ownLearner, so the
      // client picks which one via the X-Active-Learner-Id header (see api.js's request
      // interceptor); falling back to the first when absent/invalid keeps every existing
      // single-child caller working unchanged. Never trusts the header blindly — it only ever
      // resolves to one of this guardian's own learners.
      const allLearners = await LearnerModel.findAll({ guardianEmail: email });
      const activeLearners = allLearners.filter((l) => (l.accountStatus || "active") === "active");
      if (allLearners.length > 0 && activeLearners.length === 0) {
        const err = new Error("This learner account is inactive");
        err.statusCode = 403;
        throw err;
      }
      req.ownLearners = activeLearners;
      const requestedId = req.headers["x-active-learner-id"];
      req.ownLearner = (requestedId && activeLearners.find((l) => l.id === requestedId)) || activeLearners[0] || null;
    }
  }

  if (role === "curriculumAdmin") {
    const curricula = await CurriculumModel.findAll();
    req.ownCurriculum = curricula.find((c) => c.curriculumAdminId === id) || null;
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

// True whenever `hubId` is the caller's own hub — the CURRENTLY ACTIVE one for a "school"-role
// account (req.ownSchool; see attachOwnRecords above for how a parent hub's admin switches this
// across its own hub and its branches). Ownership checks are always against the active hub only,
// same "act as one at a time" posture the guardian/learner X-Active-Learner-Id pattern uses —
// not "any hub this login could ever act as". No-op (false) for every other role.
function isOwnHub(req, hubId) {
  if (!hubId) return false;
  if (req.user.role === "school") return hubId === req.ownSchool?.id;
  return false;
}

module.exports = { attachOwnRecords, assertOwn, isOwnHub };
