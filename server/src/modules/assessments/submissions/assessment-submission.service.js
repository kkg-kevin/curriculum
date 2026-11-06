const AssessmentIssueModel = require("./assessment-issue.model");
const AssessmentSubmissionModel = require("./assessment-submission.model");
const AssessmentRevocationModel = require("./assessment-revocation.model");
const CountedWork = require("./counted-work");
const AssessmentModel = require("../assessment.model");
const LearnerModel = require("../../learners/learner.model");
const LearnerHubLinkModel = require("../../learners/learner-hub-link.model");
const ClassModel = require("../../classes/class.model");
const PathwayModel = require("../../curriculum/competency-framework/pathway.model");
const AgeCategoryModel = require("../../curriculum/competency-framework/age-category.model");
const CompetencyService = require("../../curriculum/competency-framework/competency.service");
const CompetencyModel = require("../../settings/competencies/competency.model");
const EvidenceTypeModel = require("../../curriculum/competency-framework/evidence-type.model");
const AssessmentTypeModel = require("../../curriculum/competency-framework/assessment-type.model");
const ClassGroupService = require("../../classes/groups/class-group.service");
const ClassGroupModel = require("../../classes/groups/class-group.model");
const TeacherModel = require("../../teachers/teacher.model");
const UserModel = require("../../auth/user.model");
const NotificationService = require("../../notifications/notification.service");
const { requiresManualGrading, computeAutoScore, computeMaxScore, computeIndicatorBreakdown, unansweredWrittenItems, questionList } = require("./grading.utils");
const { reissueBlockerFrom } = require("./reissue.rules");
const db = require("../../../config/db");

async function loadAssessmentOrThrow(assessmentId) {
  const assessment = await AssessmentModel.findById(assessmentId);
  if (!assessment) {
    const err = new Error("Assessment not found");
    err.statusCode = 404;
    throw err;
  }
  return assessment;
}

// A standalone diagnostic issue (see issueDiagnostic below) carries an ageCategoryId — once a
// submission for it reaches "graded" (either instantly here, via submit()'s auto-grade path, or
// later via a teacher's grade() pass), its score resolves this learner's curriculum-wide
// Performance Band, and the age category it was issued for becomes their confirmed
// Developmental Stage (see CompetencyService.placeLearnerFromDiagnostic). Ordinary class-issued
// assessments have no ageCategoryId, so this is a no-op for them.
// indicatorMarks/indicatorBreakdown only ever store an indicatorId — resolve it back to its
// owning competency plus both names for display, from the global competency catalog
// (indicators aren't curriculum-scoped, so no curriculumId is needed here).
async function resolveIndicator(indicatorId) {
  const competencies = await CompetencyModel.findAll();
  for (const comp of competencies) {
    const indicator = (comp.indicators || []).find((i) => i.id === indicatorId);
    if (indicator) return { competencyId: comp.id, competencyName: comp.name, indicatorName: indicator.name };
  }
  return null;
}

// Resolves each Evidence Type's real weight for real grading, from whichever ONE Assessment
// Type references it in Score Evidence (curriculum.routes' Competencies → Assessments → Score
// Evidence panel). If an evidence type isn't configured on any Assessment Type, or is
// referenced by more than one with potentially different weights, there's no single
// unambiguous number to apply — it's left out of the map, and summarizeIndicatorProgress below
// falls back to a 1.0 (full/raw) multiplier for it, same as before this existed.
async function buildEvidenceWeightByCategory(curriculumId) {
  const weightByCategory = new Map();
  if (!curriculumId) return weightByCategory;
  const [evidenceTypes, assessmentTypes] = await Promise.all([
    EvidenceTypeModel.findByCurriculumId(curriculumId),
    AssessmentTypeModel.findByCurriculumId(curriculumId),
  ]);
  evidenceTypes.forEach((et) => {
    if (!et.category) return;
    const matches = assessmentTypes.filter((at) => (at.evidenceWeights || []).some((w) => w.evidenceTypeId === et.id));
    if (matches.length !== 1) return;
    const weight = matches[0].evidenceWeights.find((w) => w.evidenceTypeId === et.id);
    if (weight) weightByCategory.set(et.category, weight.contribution / 100);
  });
  return weightByCategory;
}

// Per-learner confidence discount for sparse evidence. A curriculum's Evidence Type can set
// minItemCount ("at least N of this expected", e.g. 3 quizzes) — schema-level only until now
// (see createEvidenceTypeSchema's own comment: "not read by the scoring engine, since a single
// evidence type can be reused across courses with different item counts"). That objection is
// about a fixed per-course count; checking it per LEARNER instead sidesteps it — regardless of
// how many quizzes exist in the abstract, we can always ask how many THIS learner has actually
// been graded on. A learner short of the expected count has their marks for that category
// scaled down proportionally (count/minItemCount) rather than counted as fully evidenced — 1 of
// 3 expected quizzes, even a perfect one, shouldn't carry the same confidence as having done
// all 3. minItemCount of 0 (never configured, the default) is a no-op — full weight, unchanged.
async function buildThresholdFactorByCategory(curriculumId, typeByAssessmentId) {
  const factorByCategory = new Map();
  if (!curriculumId) return factorByCategory;
  const evidenceTypes = await EvidenceTypeModel.findByCurriculumId(curriculumId);
  const countByCategory = new Map();
  [...typeByAssessmentId.values()].forEach((type) => {
    if (!type) return;
    countByCategory.set(type, (countByCategory.get(type) || 0) + 1);
  });
  evidenceTypes.forEach((et) => {
    if (!et.category || !et.minItemCount) return;
    const count = countByCategory.get(et.category) || 0;
    factorByCategory.set(et.category, Math.min(1, count / et.minItemCount));
  });
  return factorByCategory;
}

// Shared by getLearnerIndicatorProgress (all-time) and getLearnerIndicatorProgressForAssessments
// (course-scoped) — sums each indicator's earned/possible marks across the given graded
// submissions and resolves each indicator's display name/competency.
//
// curriculumId (when given) applies two independent factors to each submission's marks before
// summing, both defaulting to a no-op (1.0) when unconfigured:
//   1. Evidence Type contribution % (Score Evidence's "Evidence Weights") — the same math
//      Engine 1 (runAssessmentEngine) uses (score × contribution / 100), applied here to real
//      graded marks instead of a hypothetical typed-in score.
//   2. The minItemCount threshold discount (buildThresholdFactorByCategory above), for sparse
//      evidence.
// Scaling both earned and possible by the same combined factor means a lower-weighted or
// under-evidenced category's marks count for proportionally less in the pooled total (and a
// higher-weighted, fully-evidenced one for more), without changing what its own raw percentage
// would be in isolation.
async function summarizeIndicatorProgress(submissions, curriculumId = null) {
  const weightByCategory = await buildEvidenceWeightByCategory(curriculumId);
  const assessmentIds = [...new Set(submissions.map((s) => s.assessmentId))];
  const assessments = await Promise.all(assessmentIds.map((id) => AssessmentModel.findById(id)));
  const typeByAssessmentId = new Map(assessmentIds.map((id, i) => [id, assessments[i]?.type || null]));
  const thresholdFactorByCategory = await buildThresholdFactorByCategory(curriculumId, typeByAssessmentId);

  const totals = new Map();
  submissions.forEach((s) => {
    const type = typeByAssessmentId.get(s.assessmentId);
    const contributionFactor = weightByCategory.has(type) ? weightByCategory.get(type) : 1;
    const thresholdFactor = thresholdFactorByCategory.has(type) ? thresholdFactorByCategory.get(type) : 1;
    const multiplier = contributionFactor * thresholdFactor;
    (s.indicatorBreakdown || []).forEach(({ indicatorId, marksEarned, marksPossible }) => {
      const cur = totals.get(indicatorId) || { marksEarned: 0, marksPossible: 0 };
      cur.marksEarned += marksEarned * multiplier;
      cur.marksPossible += marksPossible * multiplier;
      totals.set(indicatorId, cur);
    });
  });

  const rows = await Promise.all([...totals.entries()].map(async ([indicatorId, { marksEarned, marksPossible }]) => {
    const resolved = await resolveIndicator(indicatorId);
    return {
      indicatorId,
      competencyId: resolved?.competencyId || null,
      competencyName: resolved?.competencyName || "Unknown",
      indicatorName: resolved?.indicatorName || "Unknown indicator",
      marksEarned: Math.round(marksEarned * 100) / 100,
      marksPossible: Math.round(marksPossible * 100) / 100,
      percent: marksPossible > 0 ? Math.round((marksEarned / marksPossible) * 100) : 0,
    };
  }));

  return rows.sort((a, b) => a.competencyName.localeCompare(b.competencyName) || a.indicatorName.localeCompare(b.indicatorName));
}

// A standalone diagnostic issue carries either an ageCategoryId (Developmental Stage ->
// Performance Band placement) or a pathwayId (Pathway -> starting course
// placement) — never both. Ordinary class-issued assessments have neither, so this is a
// no-op for them.
// Propagates `updates` to every OTHER submission sharing this one's (issueId, groupId) — the
// mechanism behind "one submission per group": every sibling row stays an identical mirror of
// the group's shared attempt (answers on draft/submit, score+feedback+status on grade). A no-op
// for a submission with no groupId (an ordinary individual submission).
// This learner's diagnostic issues (pathway or stage) that belong to `curriculumId`.
async function curriculumDiagnosticIssueIds(learnerId, curriculumId) {
  const issues = (await AssessmentIssueModel.findAll({ learnerId })).filter((i) => i.pathwayId || i.ageCategoryId);
  const ids = new Set();
  for (const issue of issues) {
    const owner = issue.pathwayId ? await PathwayModel.findById(issue.pathwayId) : await AgeCategoryModel.findById(issue.ageCategoryId);
    if (owner?.curriculumId === curriculumId) ids.add(issue.id);
  }
  return ids;
}

function alreadySubmitted() {
  const err = new Error("This assessment has already been submitted");
  err.statusCode = 400;
  return err;
}

// Creates a learner's submission, or returns the one that already exists when two requests open
// the same assessment at the same moment (two tabs, a double tap): the table allows one row per
// issue and learner, so the second insert is refused and that row is the answer.
async function createOrExisting(data) {
  try {
    return await AssessmentSubmissionModel.create(data);
  } catch (err) {
    if (err.code !== "ER_DUP_ENTRY") throw err;
    const existing = await AssessmentSubmissionModel.findOne({ issueId: data.issueId, learnerId: data.learnerId });
    if (!existing) throw err;
    return existing;
  }
}

// Reissues (reissueToLearner): a reissue is its own issue for one learner, with no class, pointing
// at the issue it was reissued from (reissuedFromIssueId) — a reissue of a reissue points at that
// one. The original class issue (the chain's root) is where the educator marks every attempt:
// its roster shows each learner's latest attempt.
async function rootIssueOf(issue) {
  let current = issue;
  for (let hops = 0; current?.reissuedFromIssueId && hops < 50; hops += 1) {
    const parent = await AssessmentIssueModel.findById(current.reissuedFromIssueId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

// The class an issue belongs to: its own, else (a reissue) its original's.
async function classIdForIssue(issue) {
  if (!issue) return null;
  if (issue.classId) return issue.classId;
  if (!issue.reissuedFromIssueId) return null;
  return (await rootIssueOf(issue))?.classId || null;
}

// Every reissue made from this issue (and from those), in the order they were made — one learner's
// later attempts. Each attempt needs the one before it marked, so per learner it's one line.
async function reissuesFrom(issueId) {
  const found = [];
  let frontier = [issueId];
  for (let depth = 0; frontier.length && depth < 50; depth += 1) {
    const next = (await Promise.all(frontier.map((id) => AssessmentIssueModel.findAll({ reissuedFromIssueId: id })))).flat();
    next.sort((a, b) => new Date(a.issuedAt || 0) - new Date(b.issuedAt || 0));
    found.push(...next);
    frontier = next.map((i) => i.id);
  }
  return found;
}

// A learner's latest attempt at a class issue: the newest reissue of theirs, else the class issue.
async function latestAttemptOf(root, learnerId) {
  const mine = (await reissuesFrom(root.id)).filter((i) => i.learnerId === learnerId);
  const issue = mine.length ? mine[mine.length - 1] : root;
  return { issue, submission: await AssessmentSubmissionModel.findOne({ issueId: issue.id, learnerId }) };
}

// The class issue behind an issue id (a reissue's id resolves to its root) — 404 when there's none.
async function classIssueOrThrow(issueId) {
  const found = await AssessmentIssueModel.findById(issueId);
  const root = found ? await rootIssueOf(found) : null;
  if (!root?.classId) {
    const err = new Error("Issue not found");
    err.statusCode = 404;
    throw err;
  }
  return root;
}

// The chosen learners, kept only if they're in this class (active) — refuses an empty choice.
async function learnersOfClass(classId, learnerIds) {
  const inClass = new Set((await LearnerHubLinkModel.findByClassId(classId)).filter((l) => l.status === "active").map((l) => l.learnerId));
  const ids = [...new Set(learnerIds)].filter((id) => inClass.has(id));
  if (!ids.length) {
    const err = new Error("Choose at least one learner of this class");
    err.statusCode = 400;
    throw err;
  }
  return ids;
}

// Rebuilds these learners' session reports for a class issue's session (after a revoke / give back).
async function refreshReportsFor(root, learnerIds) {
  if (!root?.classId || !root?.courseId || !learnerIds.length) return;
  await require("../../reports/report.service").refreshSessionReportsForAssessment({
    classId: root.classId, courseId: root.courseId, sessionId: root.sessionId || null,
    assessmentId: root.assessmentId, learnerIds,
  }).catch(() => {});
}

// Drops hydrated submission rows whose attempt is revoked for their learner (marking queues).
async function withoutRevoked(rows) {
  const revokedByLearner = new Map();
  const keep = await Promise.all(rows.map(async (row) => {
    const learnerId = row.submission.learnerId;
    if (!revokedByLearner.has(learnerId)) revokedByLearner.set(learnerId, AssessmentRevocationModel.revokedIssueIds(learnerId));
    return !(await revokedByLearner.get(learnerId)).has(row.submission.issueId);
  }));
  return rows.filter((_, i) => keep[i]);
}

// Refuses anything done to an attempt revoked for this learner.
async function assertNotRevoked(issue, learnerId) {
  if (await AssessmentRevocationModel.isRevoked(issue, learnerId)) {
    const err = new Error("This assessment has been revoked");
    err.statusCode = 409;
    throw err;
  }
}

// The learner's session report follows their marked work straight away (report.service.js's
// refreshSessionReportsForAssessment) — for a group submission, every member's. Required lazily:
// report.service.js requires this module. Never throws — marking must not fail because of it.
async function refreshSessionReport(submission) {
  try {
    if (!submission?.issueId) return;
    const found = await AssessmentIssueModel.findById(submission.issueId);
    // A reissue has no class of its own — its report is the original issue's class's.
    const issue = found && !found.classId && found.reissuedFromIssueId ? { ...found, classId: await classIdForIssue(found) } : found;
    if (!issue?.classId || !issue?.courseId) return;
    const learnerIds = [submission.learnerId];
    if (submission.groupId) {
      const siblings = await AssessmentSubmissionModel.findGroupSiblings(submission.issueId, submission.groupId);
      learnerIds.push(...siblings.map((s) => s.learnerId));
    }
    await require("../../reports/report.service").refreshSessionReportsForAssessment({
      classId: issue.classId, courseId: issue.courseId, sessionId: issue.sessionId || null,
      assessmentId: submission.assessmentId, learnerIds,
    });
  } catch (err) {
    console.error("[assessments] session report refresh failed:", err.message);
  }
}

async function fanOutToGroup(submission, updates) {
  if (!submission.groupId) return;
  const siblings = await AssessmentSubmissionModel.findGroupSiblings(submission.issueId, submission.groupId);
  await Promise.all(
    siblings.filter((s) => s.id !== submission.id).map((s) => AssessmentSubmissionModel.update(s.id, updates))
  );
}

// Whether a submission's own time limit (set on its issue, see issueAssessment) has run out.
// The clock starts from the submission's createdAt — stamped once, the instant
// getOrCreateSubmission first creates the row — and never resets across saveDraft calls, so
// saving and coming back later never buys the learner more time. No timeLimitMinutes on the
// issue (the common case) is a permanent false — opt-in, same posture as dueDate.
// `slackMs` counts it as run out that much early (the blank-answer check: the browser's own
// countdown hands the work in at its zero, which can land a moment before the server's).
function isExpired(issue, submission, slackMs = 0) {
  if (!issue?.timeLimitMinutes) return false;
  const deadline = new Date(submission.createdAt).getTime() + issue.timeLimitMinutes * 60000;
  return Date.now() + slackMs > deadline;
}

async function maybePlaceFromDiagnostic(submission) {
  if (submission.status !== "graded") return;
  const issue = await AssessmentIssueModel.findById(submission.issueId);
  if (!issue?.learnerId) return;
  const scorePercent = submission.maxScore > 0 ? (submission.totalScore / submission.maxScore) * 100 : 0;
  if (issue.ageCategoryId) {
    await CompetencyService.placeLearnerFromDiagnostic(issue.learnerId, issue.hubId, issue.ageCategoryId, scorePercent);
  } else if (issue.pathwayId) {
    await CompetencyService.placeLearnerFromPathwayDiagnostic(issue.learnerId, issue.pathwayId, scorePercent, issue.assessmentId);
  }
}

// Course-to-course Pathway advancement — the counterpart to maybePlaceFromDiagnostic above, but
// for an ORDINARY course-attached submission (issue.courseId/classId/sessionId set) rather than
// a standalone diagnostic issue (issue.learnerId/ageCategoryId/pathwayId set — those shapes are
// mutually exclusive, see the assessments migration's own comment). Runs after every grading that
// releases a report, alongside NotificationService.maybeNotifyLevelUp — checks every Pathway this
// graded course's class curriculum has authored against that course (a course can be the
// current-course rung of more than one Pathway, e.g. shared across curricula/pathways), and
// advances the learner past any whose indicator-contribution threshold they've now cleared. A
// no-op whenever the issue isn't course-attached, the class has no curriculum, or no Pathway in
// that curriculum lists this course.
async function maybeAdvancePathwayForCourse(submission) {
  if (submission.status !== "graded") return;
  const issue = await AssessmentIssueModel.findById(submission.issueId);
  if (!issue?.courseId || !issue.classId) return;
  const cls = await ClassModel.findById(issue.classId);
  if (!cls?.curriculumId) return;

  const pathways = await PathwayModel.findByCurriculumId(cls.curriculumId);
  const relevant = pathways.filter((p) => (p.courses || []).includes(issue.courseId));
  for (const pathway of relevant) {
    await CompetencyService.maybeAdvancePathwayCourse(cls.curriculumId, submission.learnerId, pathway.id);
  }
}

const AssessmentSubmissionService = {
  // gradedBy (see grade() below) is set to req.ownTeacher?.id when the grader has a linked
  // Teacher record — the common case — or falls back to the raw Users.id when an admin grades
  // directly with no teacher record of their own. Resolve whichever it actually is, so a
  // learner/guardian sees a real name next to their feedback rather than a bare id. Shared by
  // this module's own learner-facing reads and report.service.js's report snapshots, so the
  // grader's name is consistent wherever feedback is shown.
  async resolveGraderName(gradedBy) {
    if (!gradedBy) return null;
    const teacher = await TeacherModel.findById(gradedBy);
    if (teacher) return `${teacher.firstName} ${teacher.lastName}`;
    const user = await UserModel.findById(gradedBy);
    return user?.name || null;
  },

  // Issuing is idempotent per (assessment, session, class) — re-issuing (e.g. after editing the
  // due date) updates the existing record instead of creating a duplicate that would otherwise
  // fragment a class's roster view across two issues of "the same" assessment.
  // groupMode is left undefined by a caller that only means to touch dueDate on a re-issue —
  // only an explicit true/false attempts to change it, and even then only while nobody's
  // started (see the guard below), since flipping it mid-flight would leave a mix of individual
  // and group-linked submission rows with no consistent meaning.
  //
  // Who it's for (6 Nov 2026): no `learnerIds` → the whole class, including learners who join
  // later. `learnerIds` → only those learners of the class (forLearnerIds); issuing again to more
  // learners adds them, issuing to the whole class clears the list, and a chosen learner it was
  // revoked for gets it back. Taking it away from some is Revoke. A group assessment is always for
  // the whole class.
  async issueAssessment({ assessmentId, sessionId, courseId, classId, issuedBy, dueDate, timeLimitMinutes, groupMode, learnerIds }) {
    await loadAssessmentOrThrow(assessmentId);
    const existing = await AssessmentIssueModel.findOne({ assessmentId, sessionId, classId });
    const chosen = Array.isArray(learnerIds) ? await learnersOfClass(classId, learnerIds) : null;
    if (chosen && (groupMode ?? existing?.groupMode)) {
      const err = new Error("A group assessment is issued to the whole class");
      err.statusCode = 400;
      throw err;
    }
    if (existing) {
      const updates = {
        dueDate: dueDate ?? existing.dueDate,
        timeLimitMinutes: timeLimitMinutes !== undefined ? timeLimitMinutes : existing.timeLimitMinutes,
      };
      if (groupMode !== undefined && groupMode !== existing.groupMode) {
        const hasSubmissions = (await AssessmentSubmissionModel.findAll({ issueId: existing.id })).length > 0;
        if (hasSubmissions) {
          const err = new Error("Can't change group mode after learners have started this assessment");
          err.statusCode = 409;
          throw err;
        }
        updates.groupMode = groupMode;
      }
      const had = AssessmentIssueModel.chosenLearnersOf(existing);
      if (!chosen) {
        // To the whole class: no list any more.
        if (had) updates.forLearnerIds = null;
      } else if (had) {
        updates.forLearnerIds = [...new Set([...had, ...chosen])];
      }
      // (Chosen learners on an issue already for the whole class: they have it already.)
      const updated = await AssessmentIssueModel.update(existing.id, updates);
      if (chosen) {
        const restored = await AssessmentRevocationModel.remove(existing.id, chosen);
        if (restored) await refreshReportsFor(existing, chosen);
      }
      return updated;
    }
    return AssessmentIssueModel.create({
      assessmentId, sessionId, courseId, classId, issuedBy,
      dueDate: dueDate || null, timeLimitMinutes: timeLimitMinutes || null, groupMode: groupMode || false,
      forLearnerIds: chosen || null,
    });
  },

  // Standalone diagnostic issuance — bypasses the normal course/session attachment entirely
  // (unlike issueAssessment above), since a diagnostic is meant to run before any course is
  // even assigned. Idempotent per (assessment, learner): re-triggering (e.g. re-enrolling)
  // never creates a duplicate. Pass exactly one of ageCategoryId/pathwayId — which one is
  // set is what maybePlaceFromDiagnostic branches on at grading time. `hubId` is only ever set
  // alongside ageCategoryId — it's what lets maybePlaceFromDiagnostic write the resulting
  // stage/band placement back onto the correct hub enrollment once this is graded (see
  // CompetencyService.placeLearnerFromDiagnostic). See learner.service.js's
  // maybeAutoIssueDiagnostic for the caller(s).
  async issueDiagnostic({ assessmentId, learnerId, ageCategoryId = null, pathwayId = null, hubId = null }) {
    await loadAssessmentOrThrow(assessmentId);
    const existing = await AssessmentIssueModel.findOneStandalone({ assessmentId, learnerId, pathwayId, ageCategoryId });
    if (existing) return existing;
    return AssessmentIssueModel.create({
      assessmentId, learnerId, ageCategoryId, pathwayId, hubId,
      sessionId: null, courseId: null, classId: null,
      issuedBy: "system", dueDate: null,
    });
  },

  // A learner has just finished every other section of a course session (SectionViewPage.jsx's
  // areNonAssessmentSectionsComplete — there's no server-side section tracking). A learner only
  // ever gets what their educator issued, so (6 Nov 2026):
  //   - the assessment must be attached to that session of that course;
  //   - issued to a class of theirs → that class issue comes back, never a second copy of it
  //     (revoked for them → refused);
  //   - not issued to their class → only a learner on the course through a pathway they
  //     subscribe to (self-paced, pathway-access.js) gets their own issue, one per session;
  //     anyone else waits for their educator to issue it.
  async issueOnSessionComplete({ assessmentId, learnerId, courseId, sessionId }) {
    await loadAssessmentOrThrow(assessmentId);
    const SessionModel = require("../../courses/session.model");
    const { sessionHasAssessment } = require("../../courses/sessionAssessment.utils");
    const session = await SessionModel.findById(sessionId);
    if (!session || session.courseId !== courseId || !sessionHasAssessment(session, assessmentId)) {
      const err = new Error("That assessment isn't part of this session");
      err.statusCode = 404;
      throw err;
    }

    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const classIds = new Set(links.filter((l) => l.classId && l.status === "active").map((l) => l.classId));
    const classIssues = (await AssessmentIssueModel.findAll({ assessmentId, sessionId })).filter((i) => i.classId && classIds.has(i.classId));
    if (classIssues.length) {
      const mine = classIssues.filter((issue) => AssessmentIssueModel.isForLearner(issue, learnerId));
      for (const issue of mine) {
        if (!(await AssessmentRevocationModel.isRevoked(issue, learnerId))) return issue;
      }
      const err = new Error(mine.length ? "This assessment has been revoked" : "Your educator hasn't issued this assessment to you");
      err.statusCode = 409;
      throw err;
    }

    const open = await require("../../pathway-subscriptions/pathway-access").openCourseIds(learnerId);
    if (!open.has(courseId)) {
      const err = new Error("Your educator hasn't issued this assessment yet");
      err.statusCode = 409;
      throw err;
    }
    const existing = await AssessmentIssueModel.findOneSelfPaced({ assessmentId, learnerId, sessionId });
    if (existing) return existing;
    return AssessmentIssueModel.create({
      assessmentId, learnerId, courseId, sessionId,
      classId: null, issuedBy: "system", dueDate: null,
    });
  },

  // ── Reissue and revoke: the rules ─────────────────────────────────────────────────────────────
  // Both act on chosen learners of a CLASS issue (a reissue's own id resolves to its class issue)
  // and only on individual assessments — a group assessment is shared work, so it's revoked for
  // the whole class (revokeIssue) and never reissued to one member.
  //
  // Reissue gives a learner another attempt: a new issue for that learner alone (no class),
  // pointing at the attempt it follows (reissuedFromIssueId). The earlier attempt — its score and
  // feedback — stays as it was, shown to the learner as guidance. Allowed only when the learner's
  // LATEST attempt is marked: not before they've handed in (the original is still open to them),
  // not while their hand-in waits to be marked, not while a reissue waits for them, never while
  // revoked. The new attempt is marked on the class issue's roster (getRosterForIssue), counts in
  // place of the earlier one in reports, and the learner is told.
  //
  // Revoke for chosen learners (revokeForLearners) takes the assessment away from them alone —
  // every attempt: it leaves their list, can't be opened, handed in or marked, stops counting in
  // their reports and is no longer required of them. Their work is kept; Give back
  // (restoreForLearners) undoes it. Revoke for everyone deletes the issue (revokeIssue).

  // Why this learner can't be reissued this assessment right now, or null when they can
  // (reissue.rules.js — the same rule the roster shows). A class issue's learner must still be in
  // its class.
  async reissueBlocker(root, learnerId) {
    const revoked = await AssessmentRevocationModel.isRevoked(root, learnerId);
    const inClass = !root.classId || (await LearnerHubLinkModel.findByClassId(root.classId))
      .some((l) => l.learnerId === learnerId && l.status === "active");
    const issuedToThem = AssessmentIssueModel.isForLearner(root, learnerId);
    const mine = (await reissuesFrom(root.id)).filter((i) => i.learnerId === learnerId);
    const attempts = await Promise.all([root, ...mine].map(async (issue) => ({
      issueId: issue.id,
      submission: (await AssessmentSubmissionModel.findOne({ issueId: issue.id, learnerId })) || { status: "not_started" },
    })));
    return reissueBlockerFrom({ groupMode: !!root.groupMode, revoked, inClass, issuedToThem, attempts });
  },

  // Gives one learner another attempt (see the rules above). `issueId` may be the class issue or
  // any attempt of theirs — the new attempt always follows their latest.
  async reissueToLearner({ issueId, learnerId, dueDate = null, timeLimitMinutes = null, reissuedBy }) {
    const found = await AssessmentIssueModel.findById(issueId);
    if (!found) {
      const err = new Error("Issue not found");
      err.statusCode = 404;
      throw err;
    }
    const root = await rootIssueOf(found);
    const blocker = await AssessmentSubmissionService.reissueBlocker(root, learnerId);
    if (blocker) {
      const err = new Error(blocker);
      err.statusCode = 409;
      throw err;
    }
    const latest = await latestAttemptOf(root, learnerId);
    // One reissue per attempt per learner (UNIQUE reissuedFromIssueId + learnerId): of two reissues
    // sent at the same moment only the first is made.
    const created = await AssessmentIssueModel.create({
      assessmentId: root.assessmentId,
      learnerId,
      courseId: root.courseId,
      sessionId: root.sessionId,
      classId: null,
      issuedBy: reissuedBy,
      dueDate: dueDate || null,
      timeLimitMinutes: timeLimitMinutes || null,
      reissuedFromIssueId: latest.issue.id,
      // Carried over so a reissued Stage/Pathway diagnostic still re-triggers
      // maybePlaceFromDiagnostic when the new attempt is graded — without these, grading a
      // reissued diagnostic would silently never update the learner's placement, since
      // maybePlaceFromDiagnostic branches entirely on the SUBMISSION'S OWN issue carrying them.
      ageCategoryId: root.ageCategoryId,
      pathwayId: root.pathwayId,
      hubId: root.hubId,
    }).catch((err) => {
      if (err.code !== "ER_DUP_ENTRY") throw err;
      const dup = new Error("Already reissued — waiting for them to do it");
      dup.statusCode = 409;
      throw dup;
    });
    const assessment = await AssessmentModel.findById(root.assessmentId);
    await NotificationService.notifyLearner(learnerId, {
      type: "assessment_reissued",
      title: "Another try",
      message: `"${assessment?.name || "An assessment"}" has been given back to you for another try.`,
      payload: { assessmentId: root.assessmentId, issueId: created.id, learnerId },
    }).catch(() => {});
    return created;
  },

  // Reissues to each chosen learner who can have it; the rest come back in `skipped` with why.
  async reissueToLearners({ issueId, learnerIds, dueDate = null, timeLimitMinutes = null, reissuedBy }) {
    const reissued = [];
    const skipped = [];
    for (const learnerId of [...new Set(learnerIds)]) {
      try {
        const issue = await AssessmentSubmissionService.reissueToLearner({ issueId, learnerId, dueDate, timeLimitMinutes, reissuedBy });
        reissued.push({ learnerId, issueId: issue.id });
      } catch (err) {
        if (!err.statusCode || err.statusCode >= 500) throw err;
        const learner = await LearnerModel.findById(learnerId);
        skipped.push({ learnerId, name: learner ? `${learner.firstName} ${learner.lastName}`.trim() : "A learner", reason: err.message });
      }
    }
    return { reissued, skipped };
  },

  // Revokes a class issue for chosen learners of its class (see the rules above).
  async revokeForLearners({ issueId, learnerIds, revokedBy }) {
    const root = await classIssueOrThrow(issueId);
    if (root.groupMode) {
      const err = new Error("A group assessment is revoked for the whole class, not for chosen learners");
      err.statusCode = 400;
      throw err;
    }
    const ids = (await learnersOfClass(root.classId, learnerIds)).filter((id) => AssessmentIssueModel.isForLearner(root, id));
    const count = ids.length ? await AssessmentRevocationModel.add(root, ids, revokedBy) : 0;
    await refreshReportsFor(root, ids);
    return { revoked: count };
  },

  // Gives a revoked assessment back to chosen learners: it's theirs again, with their work.
  async restoreForLearners({ issueId, learnerIds }) {
    const root = await classIssueOrThrow(issueId);
    const count = await AssessmentRevocationModel.remove(root.id, [...new Set(learnerIds)]);
    await refreshReportsFor(root, learnerIds);
    return { restored: count };
  },

  // Every standalone issue (diagnostic or course-progress-triggered) targeting this learner
  // directly, merged with their own submission — the learnerId-keyed counterpart to
  // getIssuedAssessmentsForLearner above, which is keyed by class instead.
  // A reissue revoked for them is left out, as is one whose class issue was revoked for everyone.
  async getStandaloneIssuedAssessments(learnerId) {
    const revoked = await AssessmentRevocationModel.revokedIssueIds(learnerId);
    const all = (await AssessmentIssueModel.findAll({ learnerId })).filter((i) => !revoked.has(i.id));
    const standing = await Promise.all(all.map(async (i) => !i.reissuedFromIssueId || !(await rootIssueOf(i))?.reissuedFromIssueId));
    const issues = all.filter((_, idx) => standing[idx]);
    const rows = await Promise.all(issues.map(async (issue) => {
      const assessment = await AssessmentModel.findById(issue.assessmentId);
      const submission = await AssessmentSubmissionModel.findOne({ issueId: issue.id, learnerId });
      return { issue, assessment, submission: submission || { status: "not_started" } };
    }));
    return rows.filter((row) => !!row.assessment);
  },

  // Every assessment issued to this learner, class-issued and standalone combined, diagnostics
  // excluded (see getIssuedForLearner in the controller, which this was extracted from) — the
  // one shared source the learner-portal listing builds on.
  async getIssuedRowsForLearner(learnerId) {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const classIds = links
      .filter((l) => l.classId && l.status === "active")
      .map((l) => l.classId);
    const classRowsPerClass = await Promise.all(classIds.map((classId) => AssessmentSubmissionService.getIssuedAssessmentsForLearner(classId, learnerId)));
    const classRows = classRowsPerClass.flat();
    const standalone = await AssessmentSubmissionService.getStandaloneIssuedAssessments(learnerId);
    const standaloneRows = standalone.filter((row) => !row.issue.ageCategoryId && !row.issue.pathwayId);
    // Reissued: the new attempt replaces the earlier one on their list (6 Nov 2026). The earlier
    // attempt comes back flagged `replacedBy` (the issue that replaced it) and lists leave it out;
    // it's still here so its page, report links and the new attempt's "last time" feedback open.
    const rows = [...standaloneRows, ...classRows];
    const replacedBy = new Map(rows.filter((r) => r.issue.reissuedFromIssueId).map((r) => [r.issue.reissuedFromIssueId, r.issue.id]));
    return rows.map((row) => (replacedBy.has(row.issue.id) ? { ...row, replacedBy: replacedBy.get(row.issue.id) } : row));
  },

  // Every (assessmentId, sessionId) pair actually issued to this learner — via any of their
  // active classes, or individually (course-progress auto-issue) — regardless of assessment
  // type or category. Unlike getIssuedRowsForLearner above, nothing is excluded here (not even
  // observations or diagnostics): this only answers "has this been issued", not "should it show
  // up in the learner's to-do list". Used by CourseService.getSessions to keep a session's
  // attachedAssessments hidden from a learner until a teacher has actually issued them — see
  // assessment-issue.model.js's header comment: "A learner only ever sees an assessment via an
  // Issue," which the course-browsing view never enforced until now.
  async getIssuedSessionAssessmentKeysForLearner(learnerId) {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const classIds = links.filter((l) => l.classId && l.status === "active").map((l) => l.classId);
    const classIssues = (await Promise.all(classIds.map((classId) => AssessmentIssueModel.findAll({ classId }))))
      .flat().filter((issue) => AssessmentIssueModel.isForLearner(issue, learnerId));
    const ownIssues = await AssessmentIssueModel.findAll({ learnerId });
    // Revoked for them (every attempt): not theirs to see.
    const revoked = await AssessmentRevocationModel.revokedIssueIds(learnerId);
    const keys = new Set();
    [...classIssues, ...ownIssues].forEach((issue) => {
      if (issue.sessionId && !revoked.has(issue.id)) keys.add(`${issue.assessmentId}:${issue.sessionId}`);
    });
    return keys;
  },

  // This learner's most recent auto-issued diagnostic, if any — drives the "Diagnostic
  // Assessment" card on LearnerPage. Filtered to ageCategoryId specifically, since a
  // learner can now also hold course-progress-triggered standalone issues (see
  // issueOnSessionComplete above) that share the same learnerId-keyed issue shape. Optional
  // curriculumId narrows to the one belonging to that curriculum — a learner enrolled at
  // several hubs can hold a Stage diagnostic from each; the learner-portal's first-login gate
  // needs only the one for the hub it's currently gating (see FirstLoginDiagnosticGate.jsx).
  // Omitted, this preserves the old unscoped "first one found" behavior for LearnerPage's
  // admin card, which only ever shows one hub's context anyway.
  async getDiagnosticForLearner(learnerId, curriculumId = null) {
    const standalone = await AssessmentSubmissionService.getStandaloneIssuedAssessments(learnerId);
    const rows = standalone.filter((row) => !!row.issue.ageCategoryId);
    if (!curriculumId) return rows[0] || null;
    for (const row of rows) {
      const category = await AgeCategoryModel.findById(row.issue.ageCategoryId);
      if (category?.curriculumId === curriculumId) return row;
    }
    return null;
  },

  // Every Pathway diagnostic this learner currently holds (one per area their class's
  // courses expose, per learner.service.js's maybeAutoIssueDiagnostic) — plural counterpart to
  // getDiagnosticForLearner above, since a learner can hold several of these at once. Scoped to
  // two things so old housekeeping never blocks the first-login gate forever: (1) the area's
  // curriculum has to be one the learner is CURRENTLY actively enrolled under — an issue left
  // over from a hub/curriculum the learner has since moved on from is stale, not outstanding;
  // (2) the issue's assessmentId has to match the area's CURRENTLY configured
  // diagnosticAssessmentId — if an admin swaps which assessment an area uses for its
  // diagnostic, the learner's old issue against the previous assessment is stale too, not a
  // second diagnostic to take.
  async getPathwayDiagnosticsForLearner(learnerId) {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const activeLinks = links.filter((link) => link.status === "active" && link.classId);
    const activeClasses = await Promise.all(activeLinks.map((link) => ClassModel.findById(link.classId)));
    const activeCurriculumIds = new Set(activeClasses.map((c) => c?.curriculumId).filter(Boolean));

    const standalone = await AssessmentSubmissionService.getStandaloneIssuedAssessments(learnerId);
    const candidates = standalone.filter((row) => !!row.issue.pathwayId);
    const results = await Promise.all(candidates.map(async (row) => {
      const pathway = await PathwayModel.findById(row.issue.pathwayId);
      // A website diagnostic (issuedBy "website") uses the pathway's website assessment instead.
      const current = pathway?.diagnosticAssessmentId === row.issue.assessmentId || row.issue.issuedBy === "website";
      const matches = !!pathway && activeCurriculumIds.has(pathway.curriculumId) && current;
      return matches ? row : null;
    }));
    return results.filter(Boolean);
  },

  // Revoked: the issue goes, so it disappears from every learner's list. Their work on it is kept
  // (never deleted) but no longer counts — their session reports are rebuilt without it (a report
  // left with nothing marked is removed).
  // Revoking for everyone takes every attempt with it: the class issue, each reissue made from it
  // and any per-learner revokes of it. (A reissue's own id revokes its whole class issue.)
  async revokeIssue(issueId) {
    const found = await AssessmentIssueModel.findById(issueId);
    if (!found) return 0;
    const issue = await rootIssueOf(found);
    const attemptIds = [issue.id, ...(await reissuesFrom(issue.id)).map((i) => i.id)];
    const learnerIds = new Set();
    for (const id of attemptIds) {
      (await AssessmentSubmissionModel.findAll({ issueId: id })).forEach((s) => learnerIds.add(s.learnerId));
    }
    for (const id of attemptIds.slice(1)) await AssessmentIssueModel.delete(id);
    await AssessmentRevocationModel.deleteForIssue(issue.id);
    const result = await AssessmentIssueModel.delete(issue.id);
    await refreshReportsFor(issue, [...learnerIds]);
    return result;
  },

  async getIssue(issueId) {
    return AssessmentIssueModel.findById(issueId);
  },

  async getIssuesForClass(classId) {
    return AssessmentIssueModel.findAll({ classId });
  },

  async getIssuesForCourse(courseId) {
    return AssessmentIssueModel.findAll({ courseId });
  },

  // Shared by getSubmissionsNeedingGrading/getStandaloneSubmissionsNeedingGrading below — merges
  // each submission with its issue/assessment/learner for display, dropping any row whose
  // referenced record has since been deleted (issue revoked, assessment removed, learner
  // deleted) rather than surfacing a broken row.
  async _hydrateSubmissionRows(submissions) {
    const rows = await Promise.all(submissions.map(async (submission) => ({
      submission,
      issue: await AssessmentIssueModel.findById(submission.issueId),
      assessment: await AssessmentModel.findById(submission.assessmentId),
      learner: await LearnerModel.findById(submission.learnerId),
    })));
    return rows.filter((row) => !!row.issue && !!row.assessment && !!row.learner);
  },

  // Cross-cutting "needs grading" queue for a class — every submitted-but-ungraded submission
  // across every issue in the class, each merged with its learner/assessment for display. The
  // inverse of getRosterForIssue (which is per-issue, every learner); this is per-class, only the
  // ones actually awaiting a teacher's review, so a teacher doesn't have to open each assessment's
  // roster individually to find pending work.
  async getSubmissionsNeedingGrading(classId) {
    const submissions = await AssessmentSubmissionModel.findAll({ classId, status: "submitted" });
    const rows = await withoutRevoked(await AssessmentSubmissionService._hydrateSubmissionRows(submissions));
    return AssessmentSubmissionService._dedupeGroupRows(rows);
  },

  // Collapses every set of sibling rows sharing (issueId, groupId) down to one representative
  // (earliest submittedAt), carrying {group, memberCount} instead of a bare `learner` — without
  // this, a group of 4 submitting together would show as 4 duplicate entries in the teacher's
  // "needs grading" queue for what's conceptually one action. Individual rows pass through
  // untouched.
  async _dedupeGroupRows(rows) {
    const individual = rows.filter((row) => !row.submission.groupId);
    const grouped = rows.filter((row) => row.submission.groupId);
    const byGroupKey = new Map();
    grouped.forEach((row) => {
      const key = `${row.submission.issueId}:${row.submission.groupId}`;
      const list = byGroupKey.get(key) || [];
      list.push(row);
      byGroupKey.set(key, list);
    });
    const groupRows = await Promise.all([...byGroupKey.values()].map(async (list) => {
      list.sort((a, b) => new Date(a.submission.submittedAt) - new Date(b.submission.submittedAt));
      // Drop the representative's individual `learner` — a group row identifies itself by
      // `group`/`memberCount` instead, so a client can't mistakenly render just the one member
      // who happened to submit first as if they were the sole owner of the work.
      const { learner, ...representative } = list[0];
      const group = await ClassGroupModel.findById(representative.submission.groupId);
      return { ...representative, group: group ? { id: group.id, name: group.name } : null, memberCount: list.length };
    }));
    return [...individual, ...groupRows];
  },

  // Teacher-facing counterpart to getSubmissionsNeedingGrading above — that one only ever sees
  // class-issued submissions (filtered by submission.classId), so a learner's standalone
  // diagnostic (classId: null, see issueDiagnostic) never showed up in a teacher's queue at all.
  // Scoped by which learners are actively enrolled in this class instead, since the submission
  // itself carries no classId to filter on.
  //
  // A reissued assessment's new attempt (reissueToLearner — no class either) lands here too; its
  // row carries `reissueOf` (the original class issue, whose roster is where it's marked) — but
  // only when that original is this class's, so a learner in two classes isn't listed twice.
  async getStandaloneSubmissionsNeedingGrading(classId) {
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const learnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);
    const submissions = learnerIds.length
      ? await db("assessment_submissions").whereIn("learnerId", learnerIds).whereNull("classId").where({ status: "submitted" })
      : [];
    const rows = await withoutRevoked(await AssessmentSubmissionService._hydrateSubmissionRows(submissions));
    const shaped = await Promise.all(rows.map(async (row) => {
      if (!row.issue.reissuedFromIssueId) return row;
      const root = await rootIssueOf(row.issue);
      // Its class issue was revoked for everyone (before reissues went with it): nothing to mark.
      if (root?.reissuedFromIssueId) return null;
      if (root?.classId === classId) return { ...row, reissueOf: root.id };
      // Its original is another class's: listed there, unless the learner has left that class.
      const stillThere = root?.classId && (await LearnerHubLinkModel.findByClassId(root.classId))
        .some((l) => l.learnerId === row.submission.learnerId && l.status === "active");
      return stillThere ? null : row;
    }));
    return shaped.filter(Boolean);
  },

  rootIssueOf,
  classIdForIssue,

  // What a learner sees: every issue targeting their class, each merged with their own
  // submission (or a synthetic "not_started" placeholder if they haven't opened it yet).
  // Teacher Observation assessments (type "observation") are excluded — they have no
  // learner-facing "take" step at all, the teacher records the whole thing directly (see
  // startObservationSubmission in the controller), so there's nothing here for a learner to
  // open. Same exclusion shape getIssuedRowsForLearner already applies to standalone
  // diagnostics; the score still reaches the learner once graded, via Reports (see
  // report.service.js, which only cares about reportPublished, never assessment.type).
  async getIssuedAssessmentsForLearner(classId, learnerId) {
    // An issue revoked for this learner alone (revokeForLearners) isn't theirs any more.
    const revoked = await AssessmentRevocationModel.revokedIssueIds(learnerId);
    // An issue for chosen learners only is theirs only if they were chosen.
    const issues = (await AssessmentIssueModel.findAll({ classId }))
      .filter((i) => !revoked.has(i.id) && AssessmentIssueModel.isForLearner(i, learnerId));
    const rows = await Promise.all(issues.map(async (issue) => {
      const assessment = await AssessmentModel.findById(issue.assessmentId);
      const submission = await AssessmentSubmissionModel.findOne({ issueId: issue.id, learnerId });
      return {
        issue,
        assessment,
        submission: submission || { status: "not_started" },
      };
    }));
    return rows.filter((row) => !!row.assessment && row.assessment.type !== "observation");
  },

  // Roster view for the teacher grading a class: every enrolled learner, each merged with their
  // submission (or "not_started"). Drives both the class-wide progress summary and the
  // per-learner grading action.
  //
  // Reissues: a reissue's own address opens its original's roster (a reissue has no class), and
  // each learner's row is their LATEST attempt (`submission`, `issueId` — which issue that attempt
  // answers, for observation/milestone/reissue actions), with every attempt in `attempts`.
  async getRosterForIssue(issueId) {
    const found = await AssessmentIssueModel.findById(issueId);
    if (!found) {
      const err = new Error("Issue not found");
      err.statusCode = 404;
      throw err;
    }
    const issue = found.reissuedFromIssueId ? await rootIssueOf(found) : found;
    const assessment = await loadAssessmentOrThrow(issue.assessmentId);
    // classId/status no longer live on the learner record — resolve the roster via enrollment
    // links for this class instead (see learner-hub-link.model.js).
    const links = await LearnerHubLinkModel.findByClassId(issue.classId);
    // Issued to chosen learners only: they alone are on its roster.
    const learnerIds = links.filter((l) => l.status === "active" && AssessmentIssueModel.isForLearner(issue, l.learnerId)).map((l) => l.learnerId);
    const learners = await LearnerModel.findAll({ ids: learnerIds });
    const submissions = await AssessmentSubmissionModel.findAll({ issueId: issue.id });
    const submissionByLearner = new Map(submissions.map((s) => [s.learnerId, s]));

    // Later attempts (reissues), per learner, oldest first.
    const reissues = await reissuesFrom(issue.id);
    const laterAttempts = new Map();
    for (const re of reissues) {
      if (!re.learnerId) continue;
      const submission = await AssessmentSubmissionModel.findOne({ issueId: re.id, learnerId: re.learnerId });
      const list = laterAttempts.get(re.learnerId) || [];
      list.push({ issueId: re.id, dueDate: re.dueDate || null, issuedAt: re.issuedAt, submission: submission || { status: "not_started" } });
      laterAttempts.set(re.learnerId, list);
    }

    // Revoked for chosen learners (revokeForLearners): `revokedAt` on their row.
    const revokedAt = new Map((await AssessmentRevocationModel.forIssue(issue.id)).map((r) => [r.learnerId, r.revokedAt]));

    const roster = learners.map((learner) => {
      const attempts = [
        { issueId: issue.id, dueDate: issue.dueDate || null, issuedAt: issue.issuedAt, submission: submissionByLearner.get(learner.id) || { status: "not_started" } },
        ...(laterAttempts.get(learner.id) || []),
      ];
      const latest = attempts[attempts.length - 1];
      const revoked = revokedAt.get(learner.id) || null;
      return {
        learner, submission: latest.submission, issueId: latest.issueId, attempts, revokedAt: revoked,
        // Why they can't be reissued it now (reissue.rules.js — what reissueToLearner enforces), or null.
        reissueBlocker: reissueBlockerFrom({ groupMode: !!issue.groupMode, revoked: !!revoked, inClass: true, attempts }),
      };
    });

    // Purely additive — empty for every non-group issue, so the existing flat `roster` stays the
    // only thing any current consumer needs to look at. Populated only when issue.groupMode is
    // true: one row per class group (with its own representative submission) plus whichever
    // active learners aren't in any group yet.
    let groups = [];
    let ungroupedLearners = [];
    if (issue.groupMode) {
      const classGroups = await ClassGroupService.listGroupsForClass(issue.classId);
      const submissionByGroup = new Map();
      submissions.forEach((s) => {
        if (s.groupId && !submissionByGroup.has(s.groupId)) submissionByGroup.set(s.groupId, s);
      });
      groups = classGroups.map((g) => ({
        group: { id: g.id, name: g.name, classId: g.classId },
        members: g.members,
        submission: submissionByGroup.get(g.id) || { status: "not_started" },
      }));
      const groupedLearnerIds = new Set(classGroups.flatMap((g) => g.members.map((m) => m.id)));
      ungroupedLearners = roster.filter((row) => !groupedLearnerIds.has(row.learner.id));
    }

    return { issue, assessment, roster, groups, ungroupedLearners };
  },

  async getOrCreateSubmission({ issueId, learnerId }) {
    const issue = await AssessmentIssueModel.findById(issueId);
    if (!issue) {
      const err = new Error("Issue not found");
      err.statusCode = 404;
      throw err;
    }
    // Issued to chosen learners only, and not this one: nothing to open.
    if (issue.classId && !AssessmentIssueModel.isForLearner(issue, learnerId)) {
      const err = new Error("This assessment wasn't issued to you");
      err.statusCode = 403;
      throw err;
    }
    // Revoked for this learner: nothing to open (and, for staff, nothing to record or mark).
    await assertNotRevoked(issue, learnerId);
    const existing = await AssessmentSubmissionModel.findOne({ issueId, learnerId });
    if (existing) return existing;

    const assessment = await loadAssessmentOrThrow(issue.assessmentId);
    const base = {
      issueId,
      assessmentId: issue.assessmentId,
      learnerId,
      // The issue itself already carries which class it was issued to — that's the
      // authoritative source, not any field on the learner record.
      classId: issue.classId,
      status: "in_progress",
      answers: [],
      autoScore: null,
      autoMax: null,
      autoItemResults: [],
      manualScore: null,
      totalScore: null,
      maxScore: computeMaxScore(assessment),
      requiresManualGrading: requiresManualGrading(assessment),
      itemFeedback: [],
      overallFeedback: "",
      submittedAt: null,
      gradedAt: null,
      gradedBy: null,
      // A graded submission's score/feedback stays hidden from the learner until this flips —
      // see grade()/submit()/publishReport for exactly when that happens.
      reportPublished: false,
      reportPublishedAt: null,
      reportPublishedBy: null,
    };

    if (!issue.groupMode) return createOrExisting(base);

    // Group mode: resolve this learner's class group. No group yet -> falls back to a normal
    // solo submission (groupId stays null) — not blocked, since locking a learner out over an
    // incomplete teacher setup would be worse; they simply show up as "ungrouped" in the roster.
    const group = await ClassGroupService.getGroupForLearner(issue.classId, learnerId);
    if (!group) return createOrExisting(base);

    const siblings = await AssessmentSubmissionModel.findGroupSiblings(issueId, group.id);
    if (!siblings.length) return createOrExisting({ ...base, groupId: group.id });

    // A later group member opening it for the first time — clone the group's current shared
    // state instead of starting them blank, so they see whatever progress/result already exists
    // rather than an empty form that would silently diverge from their teammates'.
    const sibling = siblings[0];
    return createOrExisting({
      ...base,
      groupId: group.id,
      status: sibling.status,
      answers: sibling.answers,
      autoScore: sibling.autoScore,
      autoMax: sibling.autoMax,
      autoItemResults: sibling.autoItemResults,
      manualScore: sibling.manualScore,
      totalScore: sibling.totalScore,
      itemFeedback: sibling.itemFeedback,
      overallFeedback: sibling.overallFeedback,
      submittedAt: sibling.submittedAt,
      gradedAt: sibling.gradedAt,
      gradedBy: sibling.gradedBy,
      indicatorBreakdown: sibling.indicatorBreakdown,
      reportPublished: sibling.reportPublished,
      reportPublishedAt: sibling.reportPublishedAt,
      reportPublishedBy: sibling.reportPublishedBy,
    });
  },

  async saveDraft(submissionId, answers) {
    const submission = await AssessmentSubmissionModel.findById(submissionId);
    if (!submission) {
      const err = new Error("Submission not found");
      err.statusCode = 404;
      throw err;
    }
    if (submission.status !== "in_progress") {
      const err = new Error("This assessment has already been submitted");
      err.statusCode = 400;
      throw err;
    }
    const issue = await AssessmentIssueModel.findById(submission.issueId);
    await assertNotRevoked(issue, submission.learnerId);
    if (isExpired(issue, submission)) {
      const err = new Error("Time's up — this assessment's time limit has been reached. Submit it as-is.");
      err.statusCode = 409;
      throw err;
    }
    // Only while still in progress: a draft save that arrives just after the learner's own
    // Submit (a slow autosave, a second tab) must not replace the answers that were marked.
    const updated = await AssessmentSubmissionModel.updateIfInProgress(submissionId, { answers });
    if (!updated) throw alreadySubmitted();
    await fanOutToGroup(submission, { answers });
    return updated;
  },

  // Finalizes a learner's attempt. Auto-gradable items are scored immediately either way (the
  // computation itself is cheap and deterministic), but the result is only *released* — status
  // "graded" — when nothing else needs a teacher's input. Otherwise the submission holds at
  // "submitted" and the auto-score sits unreleased until the teacher's grading pass completes
  // and combines both into one release, per the release-together decision this was built around.
  async submit(submissionId, answers) {
    const submission = await AssessmentSubmissionModel.findById(submissionId);
    if (!submission) {
      const err = new Error("Submission not found");
      err.statusCode = 404;
      throw err;
    }
    if (submission.status !== "in_progress") {
      const err = new Error("This assessment has already been submitted");
      err.statusCode = 400;
      throw err;
    }

    const issue = await AssessmentIssueModel.findById(submission.issueId);
    await assertNotRevoked(issue, submission.learnerId);
    const assessment = await loadAssessmentOrThrow(submission.assessmentId);
    // Written questions can't be handed in blank — except when the time limit has run out: the
    // learner can no longer save, so whatever they have goes in as it is.
    if (!isExpired(issue, submission, 30000)) {
      const blank = unansweredWrittenItems(assessment, answers);
      if (blank.length) {
        const err = new Error(`Write your answer to ${questionList(blank.map((b) => b.number))} before handing it in.`);
        err.statusCode = 400;
        throw err;
      }
    }
    const { autoScore, autoMax, itemResults } = computeAutoScore(assessment, answers);
    const needsManual = requiresManualGrading(assessment);
    // Fully auto-gradable assessments release straight to "graded" here — their competency
    // breakdown is exact from the auto results alone, no manual itemFeedback exists yet.
    const indicatorBreakdown = needsManual ? [] : computeIndicatorBreakdown(assessment, itemResults, []);

    // Fully auto-gradable assessments have no teacher step to gate on, so their report releases
    // in the same instant as grading — only a submission a teacher actually grades (see grade())
    // goes through the separate publishReport step.
    const now = new Date();
    const updates = {
      answers,
      autoScore,
      autoMax,
      autoItemResults: itemResults,
      submittedAt: now,
      status: needsManual ? "submitted" : "graded",
      totalScore: needsManual ? null : autoScore,
      gradedAt: needsManual ? null : now,
      indicatorBreakdown: needsManual ? submission.indicatorBreakdown || [] : indicatorBreakdown,
      ...(needsManual ? {} : { reportPublished: true, reportPublishedAt: now }),
    };

    // Only the first Submit lands (the row was still "in_progress"); a second one — two group
    // members tapping at once, a double tap, a retry after a dropped connection, a second tab —
    // gets null back and the same "already submitted" answer, so marking, notifications and
    // pathway progress below run once.
    const updated = await AssessmentSubmissionModel.updateIfInProgress(submissionId, updates);
    if (!updated) throw alreadySubmitted();
    await fanOutToGroup(submission, updates);
    await maybePlaceFromDiagnostic(updated);
    if (updated.status === "graded") {
      await maybeAdvancePathwayForCourse(updated);
      await NotificationService.assessmentGraded(updated);
      await NotificationService.maybeNotifyLevelUp(updated.learnerId, updated.classId);
      await refreshSessionReport(updated);
    } else {
      await NotificationService.assessmentSubmitted(updated);
    }
    return updated;
  },

  // Teacher's grading pass — supplies marks/feedback for whatever the learner's answers didn't
  // already auto-grade (rubric criteria, short-answer items, observation indicators, deliverables).
  // Combines with any stored auto-score. Releases to the learner in the same instant — grading IS
  // reporting, for every submission regardless of classId (this used to gate class-issued
  // submissions behind a separate manual publishReport() step; that was easy to forget, leaving
  // graded work invisible to the learner indefinitely, so it's now unconditional here — see
  // publishReport below, kept only as a manual override).
  async grade(submissionId, { itemFeedback = [], overallFeedback = "", manualScore = 0, gradedBy }) {
    const submission = await AssessmentSubmissionModel.findById(submissionId);
    if (!submission) {
      const err = new Error("Submission not found");
      err.statusCode = 404;
      throw err;
    }
    // Revoked for them: give it back before marking.
    await assertNotRevoked(await AssessmentIssueModel.findById(submission.issueId), submission.learnerId);
    const assessment = await loadAssessmentOrThrow(submission.assessmentId);
    const totalScore = (submission.autoScore || 0) + (Number(manualScore) || 0);
    const indicatorBreakdown = computeIndicatorBreakdown(assessment, submission.autoItemResults, itemFeedback);

    const now = new Date();
    const updates = {
      itemFeedback,
      overallFeedback,
      manualScore: Number(manualScore) || 0,
      totalScore,
      status: "graded",
      gradedAt: now,
      gradedBy,
      indicatorBreakdown,
      reportPublished: true,
      reportPublishedAt: now,
      reportPublishedBy: gradedBy,
    };
    const graded = await AssessmentSubmissionModel.update(submissionId, updates);
    // Group-mode grading: whichever member's submission id the teacher graded, the identical
    // score/feedback/status now applies to every group member — see fanOutToGroup. The teacher
    // grades through the same PATCH endpoint either way; no separate group-grading endpoint.
    await fanOutToGroup(submission, updates);
    await maybePlaceFromDiagnostic(graded);
    await maybeAdvancePathwayForCourse(graded);
    await NotificationService.assessmentGraded(graded);
    await NotificationService.maybeNotifyLevelUp(graded.learnerId, graded.classId);
    await refreshSessionReport(graded);
    return graded;
  },

  // Grades one milestone of a project assessment, independently of everything else on the
  // submission (its own status/totalScore keep tracking the learner's own deliverable-upload
  // flow, untouched here) — a teacher can grade milestone 1 today and milestone 3 next week in
  // any order, and each is visible to the learner the instant it's saved, no publish step. The
  // submission is auto-created on the first milestone grade (same "teacher grades directly, no
  // learner action required" shape as startObservationSubmission — a project's milestones are
  // checkpoints the teacher observes, not something the learner submits per-checkpoint).
  async gradeMilestone({ issueId, learnerId, milestoneId, marks, feedback, gradedBy }) {
    const issue = await AssessmentIssueModel.findById(issueId);
    if (!issue) {
      const err = new Error("Issue not found");
      err.statusCode = 404;
      throw err;
    }
    const assessment = await loadAssessmentOrThrow(issue.assessmentId);
    const milestone = (assessment.milestones || []).find((m) => m.id === milestoneId);
    if (!milestone) {
      const err = new Error("Milestone not found on this assessment");
      err.statusCode = 404;
      throw err;
    }

    const submission = await AssessmentSubmissionService.getOrCreateSubmission({ issueId, learnerId });
    const now = new Date();
    // Clamped to the milestone's own points — same "can't exceed what it's worth" guarantee
    // MarksInputs already enforces client-side, re-asserted here since this is a genuine write
    // boundary a client could otherwise bypass.
    const entry = {
      milestoneId,
      marks: Math.max(0, Math.min(Number(marks) || 0, Number(milestone.points) || 0)),
      feedback: feedback || "",
      gradedAt: now,
      gradedBy,
    };
    const nextProgress = [...(submission.milestoneProgress || []).filter((e) => e.milestoneId !== milestoneId), entry];
    const updates = { milestoneProgress: nextProgress };
    const updated = await AssessmentSubmissionModel.update(submission.id, updates);
    // Group-mode: every member shares one project attempt, so a milestone graded for one
    // representative applies to the whole group — same fan-out grade()/submit() already use.
    await fanOutToGroup(submission, updates);
    return updated;
  },

  // Manual override, not part of the normal flow anymore — grade() above now releases every
  // submission the instant it's graded. Kept for the rare case a submission ends up graded but
  // unpublished (e.g. legacy data from before that change) and to flip it back on by hand.
  // Idempotent: publishing an already-published report is a no-op.
  async publishReport(submissionId, publishedBy) {
    const submission = await AssessmentSubmissionModel.findById(submissionId);
    if (!submission) {
      const err = new Error("Submission not found");
      err.statusCode = 404;
      throw err;
    }
    if (submission.status !== "graded") {
      const err = new Error("This submission hasn't been graded yet");
      err.statusCode = 400;
      throw err;
    }
    if (submission.reportPublished) return submission;
    const released = await AssessmentSubmissionModel.update(submissionId, {
      reportPublished: true,
      reportPublishedAt: new Date(),
      reportPublishedBy: publishedBy,
    });
    await refreshSessionReport(released);
    return released;
  },

  async getSubmission(id) {
    return AssessmentSubmissionModel.findById(id);
  },

  // Accumulating, per-learner view across every graded submission they've ever had — sums each
  // indicator's earned/possible marks across every assessment that touched it (see
  // computeIndicatorBreakdown in grading.utils.js), rather than a single point-in-time
  // snapshot. This is what finally gives the Progress Arc's indicator engine real per-learner
  // data (see CompetencyService.calculateIndicatorProgress) instead of the empty, manually-set
  // achievement store it had before.
  // Optional curriculumId narrows this down to assessments reachable from that curriculum
  // (same reachability CompetencyService.getPopulatedIndicators uses) — a learner enrolled at
  // several hubs can have indicator marks from more than one curriculum, and a hub's
  // Competencies tab should only reflect its own. Omitted, this stays the full cross-hub view,
  // which existing internal callers (getLearnerEvidenceTypeScores/getLearnerBandProgress —
  // already curriculum-scoped further downstream through their own Assessment-Type config) rely on.
  //
  // A marked diagnostic of this curriculum's pathways or stages counts too — taken in the portal or
  // on the website before enrolling (website-diagnostic.service.js) — though its assessment isn't
  // attached to a course session: it's this learner's first evidence of those competencies.
  async getLearnerIndicatorProgress(learnerId, curriculumId = null) {
    // Only work that counts (counted-work.js): not revoked, issue still standing, latest attempt.
    let submissions = (await CountedWork.sortLearnerWork(learnerId)).counted.map((e) => e.submission);
    if (curriculumId) {
      const assessmentIds = await CompetencyService.getAttachedAssessmentIds(curriculumId);
      const diagnosticIssueIds = await curriculumDiagnosticIssueIds(learnerId, curriculumId);
      submissions = submissions.filter((s) => assessmentIds.has(s.assessmentId) || diagnosticIssueIds.has(s.issueId));
    }
    return summarizeIndicatorProgress(submissions, curriculumId);
  },

  // Same aggregation, narrowed to one course's worth of assessments — the reports module's
  // "indicator breakdown within this course" view, reusing the exact indicator-resolution logic
  // above rather than duplicating it. Only counts assessments whose own report has already been
  // published to the learner — a course report shouldn't reveal a score the learner hasn't seen
  // released on its own assessment page yet.
  // `sessionIds` (a Set), when given, keeps only work issued for those sessions — a report counts
  // a session's own work, never the same assessment done in another session.
  async getLearnerIndicatorProgressForAssessments(learnerId, assessmentIds, curriculumId = null, sessionIds = null) {
    const { counted } = await CountedWork.sortLearnerWork(learnerId, { published: true });
    const submissions = counted
      .filter((e) => assessmentIds.includes(e.submission.assessmentId) && CountedWork.inSessions(e, sessionIds))
      .map((e) => e.submission);
    return summarizeIndicatorProgress(submissions, curriculumId);
  },
};

module.exports = AssessmentSubmissionService;
