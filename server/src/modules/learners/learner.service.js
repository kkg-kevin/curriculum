const crypto = require("crypto");
const LearnerModel = require("./learner.model");
const LearnerHubLinkModel = require("./learner-hub-link.model");
const LearnerTransferModel = require("./learner-transfer.model");
const SchoolModel  = require("../learning-hubs/learning-hub.model");
const ClassModel   = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const LearnerPathwayModel = require("../curriculum/competency-framework/learner-pathway.model");
const AgeCategoryModel = require("../curriculum/competency-framework/age-category.model");
const PathwayModel = require("../curriculum/competency-framework/pathway.model");
const ProgressionLadderModel = require("../curriculum/competency-framework/progression-ladder.model");
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
const TeacherModel = require("../teachers/teacher.model");

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
// age (from dateOfBirth) against that curriculum's Developmental Stages, and fills in
// currentStageId when it's still unset (an existing manual/diagnostic placement is never
// overwritten by this age guess). Placement lives on THIS hub's enrollment link, not the learner
// record — a learner enrolled at several hubs can run a different curriculum (and so a different
// stage) at each one, hence the required `hubId`.
//
// A Developmental Stage no longer auto-issues its own diagnostic — that mechanism was removed in
// favor of Pathway diagnostics doing the same age-appropriate-placement job per subject
// area (see maybeAutoIssuePathwayDiagnostics below), so a learner gets one diagnostic per
// relevant subject instead of one extra, separate "overall" diagnostic on top. currentStageId
// itself still matters beyond this: Progress Arc's band-snapshot display and Pathway's
// course-defaulting both read it (see CompetencyService.getPathway), so the age-match
// still runs — only the issueDiagnostic call was removed. AgeCategory.diagnosticAssessmentId
// remains in the schema for now (existing historical issues/reports still reference it) but the
// authoring UI (AgeCategoriesPanel) no longer exposes it, so no new stage ever sets it again.
async function maybeAutoIssueDiagnostic(learnerId, cls, hubId) {
  if (!cls?.curriculumId) return;
  const learner = await LearnerModel.findById(learnerId);
  const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
  const age = computeAge(learner?.dateOfBirth);
  let stageId = link?.currentStageId || null;
  if (age !== null) {
    const categories = await AgeCategoryModel.findByCurriculumId(cls.curriculumId);
    const category = categories.find((c) => (c.minAge == null || age >= c.minAge) && (c.maxAge == null || age <= c.maxAge));
    if (category && link && !link.currentStageId) {
      await LearnerHubLinkModel.update(link.id, { currentStageId: category.id });
    }
    // An existing manual/diagnostic placement always wins (never overwritten above), so the
    // stage a Pathway diagnostic is matched against is whichever one actually ended up set —
    // the pre-existing placement if there was one, or the freshly age-matched one otherwise.
    stageId = link?.currentStageId || category?.id || null;
  }
  await maybeAutoIssuePathwayDiagnostics(learnerId, cls, stageId);
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
// old Progression Ladder (superseded by Pathways' Developmental Stages, but never
// migrated off — see CompetenciesPage.jsx's PathwayPanel comment). Same "guess from age,
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

// A learner takes ONE diagnostic per Developmental Stage: the single Pathway in this
// curriculum whose ageCategoryId matches the learner's own current stage (see
// maybeAutoIssueDiagnostic, which resolves stageId first — an existing manual/diagnostic
// placement always wins over a fresh age guess). A Pathway now belongs to exactly one stage
// (same "belongs to one stage" shape Performance Bands already use), so at most one Pathway in
// a curriculum is ever authored against a given stage — that pathway's diagnosticAssessmentId is
// the one diagnostic the learner is issued.
//
// Deliberately NOT filtered by "which courses this class currently exposes" — the diagnostic's
// job is placement, which happens before any course is assigned, so a stage-matched pathway with
// no visible courses (or none yet) must still issue its diagnostic. The pathway's own course
// ladder is only consulted later, once the diagnostic is graded (see
// placeLearnerFromPathwayDiagnostic).
//
// No stage resolved yet (stageId == null — e.g. no dateOfBirth on file to guess one from) → no
// diagnostic is auto-issued here. That's surfaced to admins (the learner shows as "needs date of
// birth" for placement) rather than guessing; an admin can add the DOB and re-running this (it's
// idempotent) then issues the right one.
//
// If more than one pathway is somehow authored against the same stage (a misconfiguration —
// pathways are meant to partition one-per-stage), the FIRST by authoring order wins — a single
// deterministic pick, never several diagnostics. If the matched pathway has no
// diagnosticAssessmentId, nothing is issued (nothing to take).
//
// Idempotent: issueDiagnostic dedupes per (assessmentId, learnerId), so this is safe to re-run on
// every enrollment/class/DOB change. It also PRUNES: any Pathway diagnostic previously
// issued for a different stage of this same curriculum that the learner never started is
// revoked, so a learner who was over-issued (before this became stage-scoped, or after a stage
// reassignment) is left holding only the one that matches their current stage. A diagnostic the
// learner has already opened (in_progress / submitted / graded) is never touched — that's real
// work / a real placement.
async function maybeAutoIssuePathwayDiagnostics(learnerId, cls, stageId) {
  if (!cls?.curriculumId || !stageId) return;
  const allPathways = await PathwayModel.findByCurriculumId(cls.curriculumId);
  const pathwayById = new Map(allPathways.map((p) => [p.id, p]));
  const match = allPathways.find((p) => p.ageCategoryId === stageId);

  // Revoke stale un-started Pathway diagnostics for THIS curriculum's pathways — anything
  // that isn't the age-matched one.
  const issues = await AssessmentIssueModel.findAll({ learnerId });
  for (const issue of issues) {
    if (!issue.pathwayId || issue.pathwayId === match?.id) continue;
    const pathway = pathwayById.get(issue.pathwayId);
    if (!pathway) continue; // belongs to a different curriculum — leave it for that hub's gate
    const sub = await AssessmentSubmissionModel.findOne({ issueId: issue.id, learnerId });
    if (sub && sub.status !== "not_started") continue; // learner engaged with it — keep
    if (sub) await AssessmentSubmissionModel.delete(sub.id);
    await AssessmentIssueModel.delete(issue.id);
  }

  if (!match?.diagnosticAssessmentId) return;
  await AssessmentSubmissionService.issueDiagnostic({
    assessmentId: match.diagnosticAssessmentId,
    learnerId,
    pathwayId: match.id,
  });
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

// One hub's slice of the public "share via QR" profile: the enrollment itself, plus — once the
// learner is in a class there — attendance, teachers, courses, Developmental Stage, the level ladder,
// per-competency standing and Pathway placement under THAT class's curriculum. A learner at
// several hubs can run a different curriculum at each, so none of this is merged across hubs.
async function buildPublicHubSection(record, link, isCurrent, issuedRows) {
  const [hub, cls] = await Promise.all([
    SchoolModel.findById(link.hubId),
    link.classId ? ClassModel.findById(link.classId) : null,
  ]);
  const section = {
    hubName: hub?.name || null,
    gradeName: cls?.gradeName || null,
    streamName: cls?.streamName || null,
    admissionNumber: link.admissionNumber || null,
    status: link.status || "active",
    since: link.createdAt || null,
    isCurrent,
    attendance: null,
    teachers: [],
    courses: [],
    developmentalStage: null,
    currentLevel: null,
    levelJourney: [],
    competencies: [],
    competenciesOnTrack: null,
    evidenceItemsCollected: null,
    pathways: [],
  };
  if (!cls) return section;

  // "Late" still counts as attended.
  const attendanceRows = await AttendanceModel.findAll({ learnerId: record.id, classId: cls.id });
  if (attendanceRows.length) {
    const count = (status) => attendanceRows.filter((r) => r.status === status).length;
    const present = count("present");
    const late = count("late");
    section.attendance = {
      total: attendanceRows.length, present, late, absent: count("absent"), excused: count("excused"),
      rate: Math.round(((present + late) / attendanceRows.length) * 100),
      lastMarked: attendanceRows[0].date,
    };
  }

  // Who teaches this class, one entry per educator with the course(s) they take — name and photo
  // only, never their email or phone. The educator of record for a course comes first.
  const teacherLinks = await ClassCourseTeacherLinkModel.findByClassId(cls.id);
  const byTeacher = new Map();
  for (const tl of teacherLinks) {
    const entry = byTeacher.get(tl.teacherId) || { courseIds: [], isPrimary: false };
    entry.courseIds.push(tl.courseId);
    entry.isPrimary = entry.isPrimary || !!tl.isPrimary;
    byTeacher.set(tl.teacherId, entry);
  }
  section.teachers = (await Promise.all([...byTeacher.entries()].map(async ([teacherId, entry]) => {
    const teacher = await TeacherModel.findById(teacherId);
    if (!teacher || teacher.status === "inactive") return null;
    const taught = await Promise.all(entry.courseIds.map((courseId) => CourseModel.findById(courseId)));
    return {
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      photo: teacher.photo || null,
      courses: taught.filter(Boolean).map((course) => course.name),
      isPrimary: entry.isPrimary,
    };
  }))).filter(Boolean).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  const curriculumId = cls.curriculumId;
  if (!curriculumId) return section;

  // Lazily required — competency.service.js and assessment-submission.service.js already dance
  // around a circular-require chain with each other (see their own comments); doing the same
  // here avoids adding this file as a third node in that cycle.
  const CompetencyService = require("../curriculum/competency-framework/competency.service");
  const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");
  const PerformanceBandModel = require("../curriculum/competency-framework/performance-band.model");

  if (link.currentStageId) {
    const stage = await AgeCategoryModel.findById(link.currentStageId);
    // minAge/maxAge, not the stored `ageRange` column — that field is never collected by the
    // Developmental Stage authoring form (AgeCategoriesPanel), so it's always null for any stage
    // created through the app. The client derives a display range from the real numeric bounds
    // instead (see PublicLearnerProfilePage's formatAgeRange).
    section.developmentalStage = stage ? { name: stage.name, minAge: stage.minAge, maxAge: stage.maxAge } : null;
  }

  const [currentCourses, scoreRows, allCompetencies, bandProgress, journeyRows, pathwayDefs] = await Promise.all([
    CurriculumVersionService.getCurrentCourses(curriculumId, cls.gradeId),
    CompetencyService.getLearnerCompetencyScores(curriculumId, record.id),
    CompetencyService.getCurriculumCompetencies(curriculumId),
    CompetencyService.getLearnerBandProgress(curriculumId, record.id),
    CompetencyService.getPathway(curriculumId, record.id),
    PathwayModel.findByCurriculumId(curriculumId),
  ]);

  // The same list the learner's own My Courses shows. Names and sizes only — completion is
  // tracked in the learner's browser, so there is no server-side percentage to add.
  section.courses = currentCourses.map((course) => ({ name: course.name, sessionCount: course.sessionCount || 0 }));

  // Every competency in the curriculum, not only the scored ones — an unscored one goes out with
  // score null ("not assessed yet") rather than being dropped or shown as a misleading 0%.
  const scoreById = new Map(scoreRows.map((s) => [s.competencyId, s]));
  section.competencies = allCompetencies.map((c) => {
    const scored = scoreById.get(c.id);
    const threshold = c.minimumThreshold ?? 60;
    return {
      name: c.name,
      score: scored ? scored.score : null,
      band: scored?.band?.name || null,
      threshold,
      onTrack: scored ? scored.score >= threshold : false,
    };
  });
  section.competenciesOnTrack = allCompetencies.length > 0
    ? { count: section.competencies.filter((c) => c.onTrack).length, total: allCompetencies.length }
    : null;
  // Same classId scoping PortfolioSnapshot.jsx applies on the learner's own profile page —
  // "evidence collected" means evidence from THIS hub's class, not every hub they've ever touched.
  section.evidenceItemsCollected = issuedRows.filter((r) => r.issue.classId === cls.id && r.submission.status === "graded").length;

  section.levelJourney = bandProgress.map((bp) => ({ name: bp.name, completion: bp.completion, thresholdMet: bp.thresholdMet, onTrack: bp.onTrack, advancementMin: bp.advancementMin, advancementThreshold: bp.advancementThreshold }));
  // Same "highest achieved, closest-to-done next" logic as the learner portal's own
  // deriveBandJourney (client/src/modules/learner-portal/utils/bandJourney.js) — duplicated here
  // rather than imported since this is server code and that's a client-only pure function; kept
  // in sync by being this small and this simple.
  const achieved = bandProgress.filter((bp) => bp.thresholdMet);
  const current = achieved.length ? achieved[achieved.length - 1] : null;
  const remaining = bandProgress.filter((bp) => !bp.thresholdMet);
  const next = remaining.length ? remaining.reduce((best, bp) => (bp.completion > best.completion ? bp : best), remaining[0]) : null;
  section.currentLevel = { name: current?.name || null, nextLevelName: next?.name || null, nextLevelCompletion: next?.completion ?? null };

  // Where the learner sits on each Pathway's own course ladder — the same authored order
  // CompetencyService.getPathway uses for its default start (banded courses first, then the rest).
  section.pathways = await Promise.all(journeyRows.map(async (row) => {
    const def = pathwayDefs.find((p) => p.id === row.pathwayId);
    const bands = await PerformanceBandModel.findByPathway(curriculumId, row.pathwayId);
    const all = def?.courses || [];
    const sequenced = bands.map((b) => b.courseId).filter((cid) => all.includes(cid));
    const ordered = [...sequenced, ...all.filter((cid) => !sequenced.includes(cid))];
    const index = row.currentCourseId ? ordered.indexOf(row.currentCourseId) : -1;
    const course = row.currentCourseId ? await CourseModel.findById(row.currentCourseId) : null;
    return {
      name: row.pathwayName,
      currentCourseName: course?.name || null,
      step: index >= 0 ? index + 1 : null,
      totalCourses: ordered.length,
      placed: !row.isDefault,
    };
  }));

  return section;
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

    // className/courses are resolved once per distinct classId across the whole roster, not per
    // learner — a hub_usage invoice line item (hub-visit.service.js) and LogVisitModal both want
    // to show what a learner is actually enrolled in alongside the space they're being charged
    // for, and this is the one merge point every learner-list consumer already goes through.
    const classIds = [...new Set([...linkByLearnerId.values()].map((l) => l.classId).filter(Boolean))];
    const classById = new Map();
    const coursesByClassId = new Map();
    if (classIds.length > 0) {
      const [classes, courseLinks] = await Promise.all([
        Promise.all(classIds.map((id) => ClassModel.findById(id))),
        Promise.all(classIds.map((id) => ClassCourseTeacherLinkModel.findByClassId(id))),
      ]);
      classes.forEach((c) => { if (c) classById.set(c.id, c); });
      const courseIds = new Set(courseLinks.flat().map((l) => l.courseId));
      const courses = await Promise.all([...courseIds].map((id) => CourseModel.findById(id)));
      const courseById = new Map(courses.filter(Boolean).map((c) => [c.id, c]));
      classIds.forEach((id, i) => {
        const ids = new Set(courseLinks[i].map((l) => l.courseId));
        coursesByClassId.set(id, [...ids].map((cid) => courseById.get(cid)).filter(Boolean).map((c) => ({ id: c.id, name: c.name })));
      });
    }

    return learners.map((l) => {
      const link = linkByLearnerId.get(l.id);
      const cls = link.classId ? classById.get(link.classId) : null;
      // spaceId/pricingOverride* only matter for a non-school hub (see hub-visits module) — a
      // school-hub roster carries them along too since they're just null there, cheaper than
      // branching this merge on hub type.
      return {
        ...l, schoolId: link.hubId, classId: link.classId, admissionNumber: link.admissionNumber, status: link.status,
        spaceId: link.spaceId || null, pricingOverrideRate: link.pricingOverrideRate || null, pricingOverrideUnit: link.pricingOverrideUnit || null,
        className: cls?.name || null, courses: link.classId ? (coursesByClassId.get(link.classId) || []) : [],
      };
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
    await LearnerPathwayModel.deleteByLearnerId(id);
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
    // Their Home Learning enrollment row and personal Home Learning class go with them. Required
    // lazily — home-learning.service.js requires this module.
    await require("../home-learning/home-learning.service").onLearnerDeleted(id);
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

  async enrollInHub(learnerId, { hubId, classId, status, spaceId, pricingOverrideRate, pricingOverrideUnit }) {
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
    if (existing) {
      // Re-"enrolling" an already-linked learner is a no-op for class/status (unenroll + re-
      // enroll is the supported way to change those), but a non-school hub's space assignment
      // is exactly the kind of thing an admin picks after the fact via "Add Existing Learner" —
      // apply it here instead of silently discarding it, or a learner already linked with no
      // space could never get one assigned through this call.
      if (spaceId !== undefined && spaceId !== existing.spaceId) {
        await LearnerHubLinkModel.update(existing.id, { spaceId, pricingOverrideRate: pricingOverrideRate || null, pricingOverrideUnit: pricingOverrideUnit || null });
      }
      return LearnerService.getLearnerHubs(learnerId);
    }

    const year = cls?.academicYear || String(new Date().getFullYear());
    const admissionNumber = await generateAdmissionNumber(hub.code, year);
    // spaceId/pricingOverride* only ever apply to a non-school hub (see hub-visits module) — a
    // school-hub enroll call simply never sends them, so they stay null there.
    await LearnerHubLinkModel.create({ learnerId, hubId: resolvedHubId, classId: resolvedClassId || null, admissionNumber, status, spaceId: spaceId || null, pricingOverrideRate: pricingOverrideRate || null, pricingOverrideUnit: pricingOverrideUnit || null });
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
  // through a link a school printed on a badge): identity, the guardian's name, and one section
  // per hub the learner is enrolled at (see buildPublicHubSection). Deliberately excludes the
  // guardian's phone/email and anything about fees — a link meant to be scanned/shared publicly
  // (badges, posters) shouldn't hand those to whoever scans it — and individual assessment
  // scores/teacher feedback (Reports/Assessments), which can carry sensitive per-submission
  // commentary that competency/progress summaries don't.
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
    // Same "first active enrollment" fallback LearnerViewPage.jsx uses as its "current" context.
    const primaryLink = links.find((l) => l.status === "active") || links[0] || null;
    const issuedRows = links.some((l) => l.classId) ? await AssessmentSubmissionService.getIssuedRowsForLearner(record.id) : [];
    const hubs = await Promise.all(links.map((link) => buildPublicHubSection(record, link, link === primaryLink, issuedRows)));
    hubs.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

    return {
      firstName: record.firstName,
      lastName: record.lastName,
      photo: record.photo,
      age: computeAge(record.dateOfBirth),
      registrationNumber: record.registrationNumber,
      nationality: record.nationality,
      languages: record.languages,
      username: record.username,
      guardianName: record.guardianName || null,
      hubs,
    };
  },
};

module.exports = LearnerService;
