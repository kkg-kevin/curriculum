const asyncHandler = require("express-async-handler");
const LearningHubModel = require("../../modules/learning-hubs/learning-hub.model");
const LearningHubService = require("../../modules/learning-hubs/learning-hub.service");
const TeacherModel = require("../../modules/teachers/teacher.model");
const LearnerModel = require("../../modules/learners/learner.model");
const CurriculumModel = require("../../modules/curriculum/curriculum.model");

// A suspended account is NOT blocked here — it's allowed a read-only session so the client can
// load enough to show its in-app "Account Suspended" page. Writes are refused by the separate
// blockIfSuspended middleware; the client locks navigation to the suspended page.

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
      // An inactive hub is NOT blocked here — the client redirects it to the suspended page;
      // its own record still resolves so that page can load. Branches keep their existing
      // inactive-filter (a suspended parent shouldn't gain a still-active branch to act as).
      const branches = await LearningHubModel.findAll({ parentHubId: ownHub.id, includeDrafts: true });
      req.ownSchools = [ownHub, ...branches.filter((h) => h.status !== "inactive")];
      const requestedId = req.headers["x-active-hub-id"];
      req.ownSchool = (requestedId && req.ownSchools.find((h) => h.id === requestedId)) || ownHub;
      req.ownSchoolCurriculumIds = req.ownSchool ? await LearningHubService.getEffectiveCurriculumIds(req.ownSchool.id) : [];
    } else {
      req.ownSchools = [];
      req.ownSchool = null;
      req.ownSchoolCurriculumIds = [];
    }
  }

  if (role === "teacher") {
    const teachers = await TeacherModel.findAll({ email });
    // A deactivated teacher isn't blocked here (client redirects to the suspended page) — prefer
    // a non-inactive record if one exists, else fall back to the first so the page can still load.
    req.ownTeacher = teachers.find((t) => (t.status || "active") !== "inactive") || teachers[0] || null;
  }

  if (role === "learner") {
    if (req.user.username) {
      // The learner's own dedicated login (see auth.service.js's setOrCreatePasswordByUsername)
      // — resolves to exactly this one learner, never siblings, and has no concept of
      // X-Active-Learner-Id since there's only ever one to resolve to here.
      // Not blocked here for a suspended learner — the client redirects to the suspended page,
      // and that page still needs the learner record resolved to render.
      const own = await LearnerModel.findByUsername(req.user.username);
      req.ownLearner = own || null;
      req.ownLearners = own ? [own] : [];
    } else {
      // Guardian-owned account. A guardian can have more than one learner linked to the same
      // email (siblings) — every learner-scoped route authorizes off req.ownLearner, so the
      // client picks which one via the X-Active-Learner-Id header (see api.js's request
      // interceptor); falling back to the first when absent/invalid keeps every existing
      // single-child caller working unchanged. Never trusts the header blindly — it only ever
      // resolves to one of this guardian's own learners.
      const allLearners = await LearnerModel.findAll({ guardianEmail: email });
      const activeLearners = allLearners.filter((l) => (l.accountStatus || "active") === "active");
      // A guardian whose children are ALL suspended isn't blocked here (client redirects to the
      // suspended page) — expose the full set so that page can still name the learner. When at
      // least one child is active, keep the old behavior: scope only to the active ones.
      const scoped = activeLearners.length > 0 ? activeLearners : allLearners;
      req.ownLearners = scoped;
      const requestedId = req.headers["x-active-learner-id"];
      req.ownLearner = (requestedId && scoped.find((l) => l.id === requestedId)) || scoped[0] || null;
    }
  }

  if (role === "curriculumAdmin") {
    const curricula = await CurriculumModel.findAll();
    req.ownCurriculum = curricula.find((c) => c.curriculumAdminId === id) || null;
  }

  // A collaborator is invited into one admin's whole tenant (see the 20260914090000 migration's
  // header comment) — req.ownerAdminId resolves to the INVITING admin's id, not the
  // collaborator's own id, so every existing ownerAdminId-scoped read/write (isOwnedByAdmin, each
  // module's local isOwn, service-level `.where({ownerAdminId})` filters) keeps working unchanged
  // for a collaborator exactly as it does for the admin themself.
  //
  // req.user.role is then ALIASED to "admin" (the real role is kept at req.user.actualRole, which
  // blockIfCollaboratorRestricted in auth.middleware.js and the client both read) for every
  // method except DELETE, and outside the financial/admin-tooling surfaces a collaborator (scoped
  // to "content a tenant admin can create" — curricula, courses, assessments, hubs, bootcamps,
  // competitions, settings, ...) was never meant to reach: billing (invoices, customer records,
  // payments), hub-visits (non-school hub revenue logging — a hub's equivalent of billing), and
  // platform-analytics. This is deliberately a single choke point rather than 80+
  // individual edits across every controller's own `req.user.role === "admin"` ownership checks
  // (isOwnHubForAdmin, isLinkedToOwnHub, adminOwnedHubIds, etc, none of which know about
  // "collaborator" and would otherwise silently SKIP their ownership check for one, not deny it)
  // — aliasing here means every one of those checks runs exactly as it does for a real admin,
  // scoped to req.ownerAdminId same as above, with no risk of a missed call site leaking
  // cross-tenant data. DELETE is deliberately left un-aliased too: role stays "collaborator", so
  // every admin-only check downstream (authorize("admin") included) already refuses it for free —
  // a collaborator can never delete anything, without needing a separate block per delete route.
  if (role === "collaborator") {
    req.ownerAdminId = req.user.invitedByAdminId || null;
    req.user.actualRole = "collaborator";
    const path = req.originalUrl.split("?")[0];
    const isRestrictedSurface = path.startsWith("/api/billing") || path.startsWith("/api/hub-visits") || path === "/api/admin-tools" || path.startsWith("/api/admin-tools/") || path === "/api/reports/platform-analytics";
    if (req.method !== "DELETE" && !isRestrictedSurface) req.user.role = "admin";
  }

  // Each admin is its own tenant — no DB lookup needed (unlike school/teacher/learner above),
  // the tenant id is just the admin's own user id. See learning_hubs/curricula/courses/
  // assessments' ownerAdminId column and withOwnerScope in model.utils.js for how this is
  // actually enforced on queries.
  if (role === "admin") {
    req.ownerAdminId = id;
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

// True whenever `record` belongs to the caller's own admin tenant — a no-op (true) for every
// role other than "admin"/"collaborator", same posture as isOwnHub being a no-op (false) for
// roles it doesn't apply to; the difference in default is deliberate: isOwnHub only ever gates
// the "school" role, while this gates tenant access to the ownerAdminId-bearing tables (learning_
// hubs, curricula, courses, assessments, competitions, bootcamps, settings, ...), and every other
// role's access to those tables is already decided by other checks (isOwnHub, curriculum
// ownership, assertCourseAccess, etc) before this would ever run — so this must not accidentally
// block them. A collaborator's req.ownerAdminId is the INVITING admin's id (see attachOwnRecords),
// so the same `record.ownerAdminId === req.ownerAdminId` comparison scopes them identically to
// that admin, without a separate branch.
function isOwnedByAdmin(req, record) {
  if (req.user.role !== "admin" && req.user.role !== "collaborator") return true;
  return record?.ownerAdminId === req.ownerAdminId;
}

module.exports = { attachOwnRecords, assertOwn, isOwnHub, isOwnedByAdmin };
