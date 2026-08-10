const LearnerModel = require("./learner.model");
const LearnerHubLinkModel = require("./learner-hub-link.model");
const SchoolModel  = require("../learning-hubs/learning-hub.model");
const ClassModel   = require("../classes/class.model");
const LearnerJourneyModel = require("../curriculum/competency-framework/learner-journey.model");
const AgeCategoryModel = require("../curriculum/competency-framework/age-category.model");
const LearningAreaModel = require("../curriculum/competency-framework/learning-area.model");
const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");
// Models, not services, for the delete cascade below — these are dependency-free fs wrappers, so
// requiring them here can't reintroduce the circular-require chain the services already dance
// around (report.service → assessment-submission.service → competency.service → back here).
const ReportModel = require("../reports/report.model");
const AssessmentSubmissionModel = require("../assessments/submissions/assessment-submission.model");
const AssessmentIssueModel = require("../assessments/submissions/assessment-issue.model");
const AttendanceModel = require("../attendance/attendance.model");

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
async function maybeAutoIssueDiagnostic(learnerId, cls, hubId) {
  if (!cls?.curriculumId) return;
  const learner = await LearnerModel.findById(learnerId);
  const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
  const age = computeAge(learner?.dateOfBirth);
  if (age !== null) {
    const categories = await AgeCategoryModel.findByCurriculumId(cls.curriculumId);
    const category = categories.find((c) => (c.minAge == null || age >= c.minAge) && (c.maxAge == null || age <= c.maxAge));
    if (category) {
      if (link && !link.currentStageId) await LearnerHubLinkModel.update(link.id, { currentStageId: category.id });
      if (category.diagnosticAssessmentId) {
        await AssessmentSubmissionService.issueDiagnostic({ assessmentId: category.diagnosticAssessmentId, learnerId, ageCategoryId: category.id, hubId });
      }
    }
  }
  await maybeAutoIssueLearningAreaDiagnostics(learnerId, cls, age);
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
async function maybeAutoIssueLearningAreaDiagnostics(learnerId, cls, age) {
  if (!cls?.gradeId) return;
  const currentCourses = await CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId);
  const currentCourseIds = new Set(currentCourses.map((c) => c.id));
  if (currentCourseIds.size === 0) return;
  const allAreas = await LearningAreaModel.findByCurriculumId(cls.curriculumId);
  const areas = allAreas
    .filter((a) => a.diagnosticAssessmentId && (a.courses || []).some((cid) => currentCourseIds.has(cid)))
    .filter((a) => age == null || ((a.minAge == null || age >= a.minAge) && (a.maxAge == null || age <= a.maxAge)));
  for (const area of areas) {
    await AssessmentSubmissionService.issueDiagnostic({ assessmentId: area.diagnosticAssessmentId, learnerId, learningAreaId: area.id });
  }
}

const generateAdmissionNumber = async (schoolCode, year) => {
  const prefix = `${(schoolCode || "GEN").toUpperCase()}-${year}`;
  const count = await LearnerHubLinkModel.countByAdmissionPrefix(prefix);
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
};

// A learner's one global, permanent identity number — distinct from admissionNumber, which is
// per-hub-enrollment and resets per school+year (a learner enrolled at two hubs has two
// different admission numbers). Registration number is assigned once at creation, never
// editable, and never scoped to a hub. Derived from the highest existing sequence rather than a
// plain count so a deleted learner's number is never reissued to someone else.
const REGISTRATION_PREFIX = "REG-";
async function nextRegistrationNumber() {
  const learners = await LearnerModel.findAll();
  const maxSeq = learners.reduce((max, l) => {
    const seq = typeof l.registrationNumber === "string" && l.registrationNumber.startsWith(REGISTRATION_PREFIX)
      ? parseInt(l.registrationNumber.slice(REGISTRATION_PREFIX.length), 10)
      : NaN;
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `${REGISTRATION_PREFIX}${String(maxSeq + 1).padStart(6, "0")}`;
}

// Shared by create/update — a username has to be unique across every learner, since it's a
// login identifier (see auth.service.js resolving it back to a guardian account).
async function assertUsernameAvailable(username, excludeId) {
  if (!username) return;
  const existing = await LearnerModel.findByUsername(username);
  if (existing && existing.id !== excludeId) {
    const err = new Error("This username is already taken");
    err.statusCode = 409;
    throw err;
  }
}

const LearnerService = {
  async createLearner(data) {
    await assertUsernameAvailable(data.username);
    // Always server-assigned, always overwritten here regardless of what's in `data` — the
    // validation schema never exposes this field to a client, but this is the actual guarantee
    // that it can never be spoofed or overwritten on create.
    return LearnerModel.create({ ...data, registrationNumber: await nextRegistrationNumber() });
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
      const learners = await LearnerModel.findAll({ guardianEmail, ids });
      return Promise.all(
        learners.map(async (l) => ({
          ...l,
          hubCount: (await LearnerHubLinkModel.findByLearnerId(l.id)).length,
        }))
      );
    }
    let links = classId ? await LearnerHubLinkModel.findByClassId(classId) : await LearnerHubLinkModel.findByHubId(schoolId);
    if (schoolId && classId) links = links.filter((l) => l.hubId === schoolId);
    if (status) links = links.filter((l) => l.status === status);
    const linkByLearnerId = new Map(links.map((l) => [l.learnerId, l]));
    if (linkByLearnerId.size === 0) return [];
    const learners = await LearnerModel.findAll({ guardianEmail, ids: [...linkByLearnerId.keys()] });
    return learners.map((l) => {
      const link = linkByLearnerId.get(l.id);
      return { ...l, schoolId: link.hubId, classId: link.classId, admissionNumber: link.admissionNumber, status: link.status };
    });
  },

  async getLearnerById(id) {
    const record = await LearnerModel.findById(id);
    if (!record) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateLearner(id, data) {
    await assertUsernameAvailable(data.username, id);
    const record = await LearnerModel.update(id, data);
    if (!record) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteLearner(id) {
    const deleted = await LearnerModel.delete(id);
    if (!deleted) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    await LearnerJourneyModel.deleteByLearnerId(id);
    await LearnerHubLinkModel.deleteByLearnerId(id);
    // Everything else keyed to this learner goes too. Without this the records survive as
    // permanently unreachable rows — every read path resolves the learner first, so an orphaned
    // report/submission can never be opened, listed, or cleaned up again. Only learner-targeted
    // issues are removed: a class-issued assessment has learnerId null and belongs to the class,
    // not to any one learner, so it correctly stays put.
    await ReportModel.deleteByLearnerId(id);
    const submissions = await AssessmentSubmissionModel.findAll({ learnerId: id });
    await Promise.all(submissions.map((s) => AssessmentSubmissionModel.delete(s.id)));
    const issues = await AssessmentIssueModel.findAll({ learnerId: id });
    await Promise.all(issues.map((i) => AssessmentIssueModel.delete(i.id)));
    await AttendanceModel.deleteByLearnerId(id);
    return { message: "Learner deleted successfully" };
  },

  // Resolved enrollment list — each entry is the hub's own fields plus the enrollment-specific
  // facts (which class there, that hub's admission number, that hub's enrollment status), same
  // "resolve link rows into full objects" shape as TeacherService.getTeacherHubs, just richer
  // because a learner's placement within a hub is meaningful in a way a teacher's isn't.
  async getLearnerHubs(learnerId) {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const resolved = await Promise.all(
      links.map(async (link) => {
        const hub = await SchoolModel.findById(link.hubId);
        if (!hub) return null;
        const cls = link.classId ? await ClassModel.findById(link.classId) : null;
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
    );
    return resolved.filter(Boolean);
  },

  async enrollInHub(learnerId, { hubId, classId, status }) {
    if (!(await LearnerModel.findById(learnerId))) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    const hub = await SchoolModel.findById(hubId);
    if (!hub) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }

    let cls = null;
    let resolvedClassId = classId;
    let resolvedHubId = hubId;

    if (classId) {
      cls = await ClassModel.findById(classId);
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
      const hubClasses = await ClassModel.findAll({ schoolId: hubId });
      cls = hubClasses.find((c) => c.status === "active");
      if (cls) {
        resolvedClassId = cls.id;
        resolvedHubId = cls.schoolId;
      }
    }

    const existing = await LearnerHubLinkModel.findOne(learnerId, resolvedHubId);
    if (existing) return LearnerService.getLearnerHubs(learnerId);

    const year = cls?.academicYear || String(new Date().getFullYear());
    const admissionNumber = await generateAdmissionNumber(hub.code, year);
    await LearnerHubLinkModel.create({ learnerId, hubId: resolvedHubId, classId: resolvedClassId || null, admissionNumber, status });
    if (cls) await maybeAutoIssueDiagnostic(learnerId, cls, resolvedHubId);
    return LearnerService.getLearnerHubs(learnerId);
  },

  async updateEnrollment(learnerId, hubId, data) {
    const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
    if (!link) {
      const err = new Error("This learner is not enrolled at this hub");
      err.statusCode = 404;
      throw err;
    }
    let cls = null;
    if (data.classId) {
      cls = await ClassModel.findById(data.classId);
      if (!cls || cls.schoolId !== hubId) {
        const err = new Error("Class does not belong to this learning hub");
        err.statusCode = 400;
        throw err;
      }
    }
    await LearnerHubLinkModel.update(link.id, data);
    if (cls) await maybeAutoIssueDiagnostic(learnerId, cls, hubId);
    return LearnerService.getLearnerHubs(learnerId);
  },

  async unenrollFromHub(learnerId, hubId) {
    await LearnerHubLinkModel.unlink(learnerId, hubId);
    return LearnerService.getLearnerHubs(learnerId);
  },

  // Safety-net for the learner-portal's first-login diagnostic gate: enrollInHub/
  // updateEnrollment above already auto-issue on every admin-side enrollment write, but a
  // learner enrolled before their class/curriculum data was complete (or moved outside those
  // two call sites) would otherwise never get one. Re-running is always safe — issueDiagnostic
  // is idempotent per (assessment, learner), so this never creates a duplicate of anything
  // already issued.
  async ensureDiagnosticsIssued(learnerId, hubId) {
    const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
    if (!link?.classId) return;
    const cls = await ClassModel.findById(link.classId);
    if (cls) await maybeAutoIssueDiagnostic(learnerId, cls, hubId);
  },

  // Clears the first-login diagnostic gate for this one hub only — fired once the gate
  // decides there's nothing left outstanding for it (see FirstLoginDiagnosticGate.jsx). Scoped
  // to the hub-link rather than the learner record so a learner enrolled at several hubs still
  // gets gated again on a hub they haven't cleared yet, even after clearing another one.
  async markHubOnboardingComplete(learnerId, hubId) {
    const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
    if (!link) return null;
    return LearnerHubLinkModel.update(link.id, { onboardingCompletedAt: new Date() });
  },
};

module.exports = LearnerService;
