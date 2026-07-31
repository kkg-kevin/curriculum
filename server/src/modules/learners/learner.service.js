const LearnerModel = require("./learner.model");
const LearnerHubLinkModel = require("./learner-hub-link.model");
const SchoolModel  = require("../learning-hubs/learning-hub.model");
const ClassModel   = require("../classes/class.model");
const LearnerJourneyModel = require("../curriculum/competency-framework/learner-journey.model");
const AgeCategoryModel = require("../curriculum/competency-framework/age-category.model");
const LearningAreaModel = require("../curriculum/competency-framework/learning-area.model");
const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");

function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Runs whenever a learner's enrollment resolves a class (and so a curriculum) — matches their
// age (from dateOfBirth) against that curriculum's Developmental Stages, and if the matched
// stage has a diagnostic assessment configured, auto-issues it (see
// AssessmentSubmissionService.issueDiagnostic, idempotent per learner+assessment). An existing
// manual/diagnostic placement is never overwritten by this age guess — only fills in
// currentStageId when it's still unset. Placement lives on THIS hub's enrollment link, not the
// learner record — a learner enrolled at several hubs can run a different curriculum (and so a
// different stage/band) at each one, hence the required `hubId`. Also auto-issues one
// diagnostic per Learning Area the class's courses actually expose (see
// maybeAutoIssueLearningAreaDiagnostics below) — a separate placement identity (starting course
// per area) from the stage/band one above.
function maybeAutoIssueDiagnostic(learnerId, cls, hubId) {
  if (!cls?.curriculumId) return;
  const learner = LearnerModel.findById(learnerId);
  const link = LearnerHubLinkModel.findOne(learnerId, hubId);
  const age = computeAge(learner?.dateOfBirth);
  if (age !== null) {
    const category = AgeCategoryModel.findByCurriculumId(cls.curriculumId)
      .find((c) => (c.minAge == null || age >= c.minAge) && (c.maxAge == null || age <= c.maxAge));
    if (category) {
      if (link && !link.currentStageId) LearnerHubLinkModel.update(link.id, { currentStageId: category.id });
      if (category.diagnosticAssessmentId) {
        AssessmentSubmissionService.issueDiagnostic({ assessmentId: category.diagnosticAssessmentId, learnerId, ageCategoryId: category.id, hubId });
      }
    }
  }
  maybeAutoIssueLearningAreaDiagnostics(learnerId, cls, age);
}

// One diagnostic per Learning Area whose courses are actually visible to this class (via the
// curriculum's live version, same source ClassViewPage's "Courses & Educators" panel reads),
// that has a diagnosticAssessmentId configured, and whose own minAge/maxAge (if set) covers this
// learner — same open-ended-range matching as the stage lookup above, so a learner is never owed
// every learning area in the curriculum, only the ones actually meant for their age. `age` is
// null when the learner has no dateOfBirth on file; that skips the age check entirely (every
// eligible area still issues) rather than risk under-diagnosing someone we can't place by age at
// all. issueDiagnostic's own (assessmentId, learnerId) idempotency means this is safe to re-run on
// every enrollment/class change — a learner already holding a given area's diagnostic never gets
// a duplicate, and moving to a class exposing a *new* area issues just that one.
function maybeAutoIssueLearningAreaDiagnostics(learnerId, cls, age) {
  if (!cls?.gradeId) return;
  const currentCourseIds = new Set(CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId).map((c) => c.id));
  if (currentCourseIds.size === 0) return;
  const areas = LearningAreaModel.findByCurriculumId(cls.curriculumId)
    .filter((a) => a.diagnosticAssessmentId && (a.courses || []).some((cid) => currentCourseIds.has(cid)))
    .filter((a) => age == null || ((a.minAge == null || age >= a.minAge) && (a.maxAge == null || age <= a.maxAge)));
  for (const area of areas) {
    AssessmentSubmissionService.issueDiagnostic({ assessmentId: area.diagnosticAssessmentId, learnerId, learningAreaId: area.id });
  }
}

const generateAdmissionNumber = (schoolCode, year) => {
  const prefix = `${(schoolCode || "GEN").toUpperCase()}-${year}`;
  const count = LearnerHubLinkModel.countByAdmissionPrefix(prefix);
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
};

// A learner's one global, permanent identity number — distinct from admissionNumber, which is
// per-hub-enrollment and resets per school+year (a learner enrolled at two hubs has two
// different admission numbers). Registration number is assigned once at creation, never
// editable, and never scoped to a hub. Derived from the highest existing sequence rather than a
// plain count so a deleted learner's number is never reissued to someone else.
const REGISTRATION_PREFIX = "REG-";
function nextRegistrationNumber() {
  const maxSeq = LearnerModel.findAll().reduce((max, l) => {
    const seq = typeof l.registrationNumber === "string" && l.registrationNumber.startsWith(REGISTRATION_PREFIX)
      ? parseInt(l.registrationNumber.slice(REGISTRATION_PREFIX.length), 10)
      : NaN;
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `${REGISTRATION_PREFIX}${String(maxSeq + 1).padStart(6, "0")}`;
}

// Shared by create/update — a username has to be unique across every learner, since it's a
// login identifier (see auth.service.js resolving it back to a guardian account).
function assertUsernameAvailable(username, excludeId) {
  if (!username) return;
  const existing = LearnerModel.findByUsername(username);
  if (existing && existing.id !== excludeId) {
    const err = new Error("This username is already taken");
    err.statusCode = 409;
    throw err;
  }
}

const LearnerService = {
  async createLearner(data) {
    assertUsernameAvailable(data.username);
    // Always server-assigned, always overwritten here regardless of what's in `data` — the
    // validation schema never exposes this field to a client, but this is the actual guarantee
    // that it can never be spoofed or overwritten on create.
    return LearnerModel.create({ ...data, registrationNumber: nextRegistrationNumber() });
  },

  // When scoped by `schoolId`/`classId`, resolves matching enrollment links first, then merges
  // each learner's *own* schoolId/classId/admissionNumber/status back onto the returned object
  // from that link. This preserves the flat response shape every existing class-roster,
  // attendance, and school-scoped consumer already expects (they filter by query param, not by
  // reading these fields off a learner object) even though the fields no longer live on the
  // learner record itself. A learner can have at most one link per hub and at most one link per
  // class, so this merge is always unambiguous. Unscoped (no schoolId/classId) returns bare
  // identity records — there's no single enrollment to merge.
  async getAllLearners({ schoolId, classId, status, guardianEmail, ids } = {}) {
    if (!schoolId && !classId) {
      // No single admissionNumber applies across hubs, but a hub count is real, cheap to
      // compute here, and lets the flat cross-hub card show something more honest than
      // "no ID" for a learner who simply isn't scoped to one hub in this view.
      return LearnerModel.findAll({ guardianEmail, ids }).map((l) => ({
        ...l,
        hubCount: LearnerHubLinkModel.findByLearnerId(l.id).length,
      }));
    }
    let links = classId ? LearnerHubLinkModel.findByClassId(classId) : LearnerHubLinkModel.findByHubId(schoolId);
    if (schoolId && classId) links = links.filter((l) => l.hubId === schoolId);
    if (status) links = links.filter((l) => l.status === status);
    const linkByLearnerId = new Map(links.map((l) => [l.learnerId, l]));
    if (linkByLearnerId.size === 0) return [];
    const learners = LearnerModel.findAll({ guardianEmail, ids: [...linkByLearnerId.keys()] });
    return learners.map((l) => {
      const link = linkByLearnerId.get(l.id);
      return { ...l, schoolId: link.hubId, classId: link.classId, admissionNumber: link.admissionNumber, status: link.status };
    });
  },

  async getLearnerById(id) {
    const record = LearnerModel.findById(id);
    if (!record) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateLearner(id, data) {
    assertUsernameAvailable(data.username, id);
    const record = LearnerModel.update(id, data);
    if (!record) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteLearner(id) {
    const deleted = LearnerModel.delete(id);
    if (!deleted) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    LearnerJourneyModel.deleteByLearnerId(id);
    LearnerHubLinkModel.deleteByLearnerId(id);
    return { message: "Learner deleted successfully" };
  },

  // Resolved enrollment list — each entry is the hub's own fields plus the enrollment-specific
  // facts (which class there, that hub's admission number, that hub's enrollment status), same
  // "resolve link rows into full objects" shape as TeacherService.getTeacherHubs, just richer
  // because a learner's placement within a hub is meaningful in a way a teacher's isn't.
  async getLearnerHubs(learnerId) {
    return LearnerHubLinkModel.findByLearnerId(learnerId)
      .map((link) => {
        const hub = SchoolModel.findById(link.hubId);
        if (!hub) return null;
        const cls = link.classId ? ClassModel.findById(link.classId) : null;
        return {
          ...hub, linkId: link.id, classId: link.classId || "", class: cls,
          admissionNumber: link.admissionNumber, status: link.status,
          // Per-hub counterpart to the old learner-level portalOnboardingCompletedAt — a
          // learner enrolled at several hubs needs the first-login diagnostic gate to
          // re-trigger for a hub they haven't cleared yet, even after clearing another one.
          onboardingCompletedAt: link.onboardingCompletedAt || null,
          // This hub's own Developmental Stage / Performance Band placement — see
          // maybeAutoIssueDiagnostic's comment for why this lives per-hub, not on the learner.
          currentStageId: link.currentStageId || null,
          currentBandId: link.currentBandId || null,
        };
      })
      .filter(Boolean);
  },

  async enrollInHub(learnerId, { hubId, classId, status }) {
    if (!LearnerModel.findById(learnerId)) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    const hub = SchoolModel.findById(hubId);
    if (!hub) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }

    let cls = null;
    let resolvedClassId = classId;
    let resolvedHubId = hubId;

    if (classId) {
      cls = ClassModel.findById(classId);
      if (!cls) {
        const err = new Error("Class not found");
        err.statusCode = 400;
        throw err;
      }
      if (cls.schoolId !== hubId) {
        const err = new Error("Class does not belong to this learning hub");
        err.statusCode = 400;
        throw err;
      }
      resolvedHubId = cls.schoolId;
    } else {
      // If no class specified, auto-assign to first active class at this hub
      const hubClasses = ClassModel.findAll({ schoolId: hubId });
      cls = hubClasses.find((c) => c.status === "active");
      if (cls) {
        resolvedClassId = cls.id;
        resolvedHubId = cls.schoolId;
      }
    }

    const existing = LearnerHubLinkModel.findOne(learnerId, resolvedHubId);
    if (existing) return LearnerService.getLearnerHubs(learnerId);

    const year = cls?.academicYear || String(new Date().getFullYear());
    const admissionNumber = generateAdmissionNumber(hub.code, year);
    LearnerHubLinkModel.create({ learnerId, hubId: resolvedHubId, classId: resolvedClassId || "", admissionNumber, status });
    if (cls) maybeAutoIssueDiagnostic(learnerId, cls, resolvedHubId);
    return LearnerService.getLearnerHubs(learnerId);
  },

  async updateEnrollment(learnerId, hubId, data) {
    const link = LearnerHubLinkModel.findOne(learnerId, hubId);
    if (!link) {
      const err = new Error("This learner is not enrolled at this hub");
      err.statusCode = 404;
      throw err;
    }
    let cls = null;
    if (data.classId) {
      cls = ClassModel.findById(data.classId);
      if (!cls || cls.schoolId !== hubId) {
        const err = new Error("Class does not belong to this learning hub");
        err.statusCode = 400;
        throw err;
      }
    }
    LearnerHubLinkModel.update(link.id, data);
    if (cls) maybeAutoIssueDiagnostic(learnerId, cls, hubId);
    return LearnerService.getLearnerHubs(learnerId);
  },

  async unenrollFromHub(learnerId, hubId) {
    LearnerHubLinkModel.unlink(learnerId, hubId);
    return LearnerService.getLearnerHubs(learnerId);
  },

  // Safety-net for the learner-portal's first-login diagnostic gate: enrollInHub/
  // updateEnrollment above already auto-issue on every admin-side enrollment write, but a
  // learner enrolled before their class/curriculum data was complete (or moved outside those
  // two call sites) would otherwise never get one. Re-running is always safe — issueDiagnostic
  // is idempotent per (assessment, learner), so this never creates a duplicate of anything
  // already issued.
  async ensureDiagnosticsIssued(learnerId, hubId) {
    const link = LearnerHubLinkModel.findOne(learnerId, hubId);
    if (!link?.classId) return;
    const cls = ClassModel.findById(link.classId);
    if (cls) maybeAutoIssueDiagnostic(learnerId, cls, hubId);
  },

  // Clears the first-login diagnostic gate for this one hub only — fired once the gate
  // decides there's nothing left outstanding for it (see FirstLoginDiagnosticGate.jsx). Scoped
  // to the hub-link rather than the learner record so a learner enrolled at several hubs still
  // gets gated again on a hub they haven't cleared yet, even after clearing another one.
  async markHubOnboardingComplete(learnerId, hubId) {
    const link = LearnerHubLinkModel.findOne(learnerId, hubId);
    if (!link) return null;
    return LearnerHubLinkModel.update(link.id, { onboardingCompletedAt: new Date().toISOString() });
  },
};

module.exports = LearnerService;
