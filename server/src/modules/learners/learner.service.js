const crypto = require("crypto");
const LearnerModel = require("./learner.model");
const LearnerHubLinkModel = require("./learner-hub-link.model");
const LearnerTransferModel = require("./learner-transfer.model");
const SchoolModel  = require("../learning-hubs/learning-hub.model");
const ClassModel   = require("../classes/class.model");
const LearnerJourneyModel = require("../curriculum/competency-framework/learner-journey.model");
const AgeCategoryModel = require("../curriculum/competency-framework/age-category.model");
const LearningAreaModel = require("../curriculum/competency-framework/learning-area.model");
const ProgressionLadderModel = require("../curriculum/competency-framework/progression-ladder.model");
const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");
// Models, not services, for the delete cascade below — these are dependency-free fs wrappers, so
// requiring them here can't reintroduce the circular-require chain the services already dance
// around (report.service → assessment-submission.service → competency.service → back here).
const ReportModel = require("../reports/report.model");
const AssessmentSubmissionModel = require("../assessments/submissions/assessment-submission.model");
const AssessmentIssueModel = require("../assessments/submissions/assessment-issue.model");
const AttendanceModel = require("../attendance/attendance.model");
const ClassGroupService = require("../classes/groups/class-group.service");
const CourseModel = require("../courses/course.model");

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
  await maybeAutoPlaceRung(learner, cls, age);
}

// Parses a rung's free-text ageRange ("12-14", "15+", "5") into numeric bounds. Unlike
// AgeCategoryModel, progression_ladder_rungs never got structured minAge/maxAge columns — it's
// always been a single string field (see the migration) meant for on-screen display, so this is
// the only way to match it against a learner's computed age. An unparseable/empty range just
// can't ever match, same as a rung nobody bothered to fill in for.
function parseAgeRange(ageRange) {
  const nums = (ageRange || "").match(/\d+(\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const min = Number(nums[0]);
  const max = nums.length > 1 ? Number(nums[1]) : ((ageRange || "").includes("+") ? null : min);
  return { min, max };
}

// Legacy counterpart to the Developmental Stage age-match above, for curricula still on the
// old Progression Ladder (superseded by Learning Areas' Developmental Stages, but never
// migrated off — see CompetenciesPage.jsx's LearningJourneyPanel comment). Same "guess from age,
// never overwrite an existing placement" rule, just matched against ageRange strings instead of
// minAge/maxAge columns. currentRungId lives on the learner record itself, not the hub link —
// matching where JourneyPlacementCard already writes it when set manually, and the same
// limitation that implies: a learner enrolled at several hubs can only ever have one active rung,
// same as before this just auto-fills it instead of requiring a manual pick.
async function maybeAutoPlaceRung(learner, cls, age) {
  if (!learner || learner.currentRungId || age === null || !cls?.curriculumId) return;
  const rungs = await ProgressionLadderModel.findByCurriculumId(cls.curriculumId);
  const matched = rungs.find((r) => {
    const range = parseAgeRange(r.ageRange);
    return range && age >= range.min && (range.max == null || age <= range.max);
  });
  if (matched) await LearnerModel.update(learner.id, { currentRungId: matched.id });
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
  const highest = await LearnerModel.findHighestRegistrationNumber(REGISTRATION_PREFIX);
  const seq = highest && typeof highest.registrationNumber === "string"
    ? parseInt(highest.registrationNumber.slice(REGISTRATION_PREFIX.length), 10)
    : NaN;
  const maxSeq = Number.isFinite(seq) ? seq : 0;
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
    return LearnerModel.create({
      ...data,
      accountStatus: data.accountStatus || "active",
      registrationNumber: await nextRegistrationNumber(),
    });
  },

  // When scoped by `schoolId`/`classId`, resolves matching enrollment links first, then merges
  // each learner's *own* schoolId/classId/admissionNumber/status back onto the returned object
  // from that link. This preserves the flat response shape every existing class-roster,
  // attendance, and school-scoped consumer already expects (they filter by query param, not by
  // reading these fields off a learner object) even though the fields no longer live on the
  // learner record itself. A learner can have at most one link per hub and at most one link per
  // class, so this merge is always unambiguous. Unscoped (no schoolId/classId) returns bare
  // identity records — there's no single enrollment to merge.
  async getAllLearners({ schoolId, classId, status, guardianEmail, ids, limit, offset } = {}) {
    if (!schoolId && !classId) {
      // No single admissionNumber applies across hubs, but a hub count is real, cheap to
      // compute here, and lets the flat cross-hub card show something more honest than
      // "no ID" for a learner who simply isn't scoped to one hub in this view. This is the
      // genuinely unbounded case (no hub/class to narrow it) — limit/offset matter most here.
      const learners = await LearnerModel.findAll({ guardianEmail, ids, limit, offset });
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
    await ClassGroupService.removeLearnerEverywhere(id);
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

  // Moves a learner from one hub to another in one action — enroll-at-new then unlink-old, the
  // same two primitives enrollInHub/unenrollFromHub already expose separately, just ordered so a
  // failure partway through never leaves the learner unenrolled everywhere (the new link is
  // created first). The old hub-link is still a real unlink — hard-deleted exactly like
  // unenrollFromHub always did, deliberately NOT kept alive with a "transferred" status, since
  // dozens of existing call sites read learner_hub_links without filtering by status and would
  // otherwise start showing a learner as still "in" a class/hub they've actually left.
  // LearnerTransferModel is a separate, purely additive audit log instead, so the transfer's
  // history survives the unlink.
  async transferHub(learnerId, { fromHubId, toHubId, toClassId, transferredBy }) {
    if (fromHubId === toHubId) {
      const err = new Error("Learner is already at this hub");
      err.statusCode = 400;
      throw err;
    }
    const fromLink = await LearnerHubLinkModel.findOne(learnerId, fromHubId);
    if (!fromLink) {
      const err = new Error("This learner isn't enrolled at the hub being transferred from");
      err.statusCode = 404;
      throw err;
    }
    await LearnerService.enrollInHub(learnerId, { hubId: toHubId, classId: toClassId || "", status: "active" });
    await LearnerTransferModel.create({
      learnerId, fromHubId, toHubId,
      fromClassId: fromLink.classId, toClassId: toClassId || null,
      fromAdmissionNumber: fromLink.admissionNumber,
      transferredBy: transferredBy || null,
    });
    await LearnerHubLinkModel.unlink(learnerId, fromHubId);
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

  // Lazily issues this learner's "share via QR" token the first time it's requested, rather
  // than backfilling every learner on creation — a learner nobody has ever shared stays with no
  // live public link. Idempotent: a second call just hands back the same token.
  async getOrCreatePublicToken(id) {
    const record = await LearnerService.getLearnerById(id);
    if (record.publicToken) return record.publicToken;
    const token = crypto.randomBytes(24).toString("base64url");
    await LearnerModel.update(id, { publicToken: token });
    return token;
  },

  // Invalidates whatever QR/link is already printed or shared — the old token stops resolving
  // the instant this runs, since getPublicProfile below looks records up BY token. The caller
  // (an authenticated admin/school, see learner.controller.js) reprints/reshares the
  // new one.
  async regeneratePublicToken(id) {
    await LearnerService.getLearnerById(id);
    const token = crypto.randomBytes(24).toString("base64url");
    await LearnerModel.update(id, { publicToken: token });
    return token;
  },

  // What an unauthenticated scan of the QR sees — still a hand-built allow-list (never
  // `{...record}`, so a field added to the learner schema later can't silently start leaking
  // through a link a school printed on a badge), but now a comprehensive one covering everything
  // shown on this learner's own Profile page: full identity, guardian contact, Developmental
  // Stage/Performance Band placement, the Progress Arc ladder, per-competency standing, and
  // Learning Journey course placement per area. Deliberately still excludes individual assessment
  // scores/teacher feedback (Reports/Assessments) — that can carry sensitive per-submission
  // commentary that competency/progress summaries don't. Class/hub comes from the same "first
  // active enrollment" fallback LearnerViewPage.jsx already uses as its "current" context.
  async getPublicProfile(token) {
    const record = await LearnerModel.findByPublicToken(token);
    if (!record) {
      const err = new Error("This link is no longer valid");
      err.statusCode = 404;
      throw err;
    }
    if ((record.accountStatus || "active") !== "active") {
      const err = new Error("This link is no longer valid");
      err.statusCode = 404;
      throw err;
    }
    const links = await LearnerHubLinkModel.findByLearnerId(record.id);
    const primaryLink = links.find((l) => l.status === "active") || links[0] || null;
    let hubName = null;
    let gradeName = null;
    let streamName = null;
    let curriculumId = null;
    if (primaryLink) {
      const hub = await SchoolModel.findById(primaryLink.hubId);
      hubName = hub?.name || null;
      if (primaryLink.classId) {
        const cls = await ClassModel.findById(primaryLink.classId);
        gradeName = cls?.gradeName || null;
        streamName = cls?.streamName || null;
        curriculumId = cls?.curriculumId || null;
      }
    }

    let developmentalStage = null;
    let competencies = [];
    let competenciesOnTrack = null;
    let evidenceItemsCollected = null;
    let levelJourney = [];
    let currentLevel = null;
    let learningJourney = [];

    if (curriculumId) {
      // Lazily required — competency.service.js and assessment-submission.service.js already
      // dance around a circular-require chain with each other (see their own comments); doing
      // the same here avoids adding this file as a third node in that cycle.
      const CompetencyService = require("../curriculum/competency-framework/competency.service");

      if (primaryLink?.currentStageId) {
        const AgeCategoryModel = require("../curriculum/competency-framework/age-category.model");
        const stage = await AgeCategoryModel.findById(primaryLink.currentStageId);
        developmentalStage = stage ? { name: stage.name, ageRange: stage.ageRange } : null;
      }

      const [scoreRows, allCompetencies, bandProgress, journeyRows, issuedRows] = await Promise.all([
        CompetencyService.getLearnerCompetencyScores(curriculumId, record.id),
        CompetencyService.getCurriculumCompetencies(curriculumId),
        CompetencyService.getLearnerBandProgress(curriculumId, record.id),
        CompetencyService.getLearningJourney(curriculumId, record.id),
        AssessmentSubmissionService.getIssuedRowsForLearner(record.id),
      ]);

      competencies = scoreRows.map((s) => ({ name: s.name, score: s.score, band: s.band?.name || null }));
      const onTrackCount = scoreRows.filter((s) => {
        const threshold = allCompetencies.find((c) => c.id === s.competencyId)?.minimumThreshold ?? 60;
        return s.score >= threshold;
      }).length;
      competenciesOnTrack = allCompetencies.length > 0 ? `${onTrackCount}/${allCompetencies.length}` : null;
      // Same classId scoping PortfolioSnapshot.jsx applies on the learner's own profile page —
      // "evidence collected" means evidence from THIS hub's class, not every hub they've ever
      // touched.
      const evidenceRows = primaryLink?.classId ? issuedRows.filter((r) => r.issue.classId === primaryLink.classId) : issuedRows;
      evidenceItemsCollected = evidenceRows.filter((r) => r.submission.status === "graded").length;

      levelJourney = bandProgress.map((bp) => ({ name: bp.name, completion: bp.completion, thresholdMet: bp.thresholdMet, advancementThreshold: bp.advancementThreshold }));
      // Same "highest achieved, closest-to-done next" logic as the learner portal's own
      // deriveBandJourney (client/src/modules/learner-portal/utils/bandJourney.js) — duplicated
      // here rather than imported since this is server code and that's a client-only pure
      // function; kept in sync by being this small and this simple.
      const achieved = bandProgress.filter((bp) => bp.thresholdMet);
      const current = achieved.length ? achieved[achieved.length - 1] : null;
      const remaining = bandProgress.filter((bp) => !bp.thresholdMet);
      const next = remaining.length ? remaining.reduce((best, bp) => (bp.completion > best.completion ? bp : best), remaining[0]) : null;
      currentLevel = { name: current?.name || null, nextLevelName: next?.name || null, nextLevelCompletion: next?.completion ?? null };

      learningJourney = await Promise.all(journeyRows.map(async (row) => {
        const course = row.currentCourseId ? await CourseModel.findById(row.currentCourseId) : null;
        return { learningAreaName: row.learningAreaName, currentCourseName: course?.name || null };
      }));
    }

    return {
      firstName: record.firstName,
      lastName: record.lastName,
      photo: record.photo,
      age: computeAge(record.dateOfBirth),
      registrationNumber: record.registrationNumber,
      nationality: record.nationality,
      languages: record.languages,
      username: record.username,
      hubName,
      gradeName,
      streamName,
      guardianName: record.guardianName,
      guardianEmail: record.guardianEmail,
      developmentalStage,
      currentLevel,
      levelJourney,
      competencies,
      competenciesOnTrack,
      evidenceItemsCollected,
      learningJourney,
    };
  },
};

module.exports = LearnerService;
