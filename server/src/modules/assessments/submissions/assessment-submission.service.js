const AssessmentIssueModel = require("./assessment-issue.model");
const AssessmentSubmissionModel = require("./assessment-submission.model");
const AssessmentModel = require("../assessment.model");
const LearnerModel = require("../../learners/learner.model");
const LearnerHubLinkModel = require("../../learners/learner-hub-link.model");
const ClassModel = require("../../classes/class.model");
const LearningAreaModel = require("../../curriculum/competency-framework/learning-area.model");
const AgeCategoryModel = require("../../curriculum/competency-framework/age-category.model");
const CompetencyService = require("../../curriculum/competency-framework/competency.service");
const CompetencyModel = require("../../settings/competencies/competency.model");
const ClassGroupService = require("../../classes/groups/class-group.service");
const ClassGroupModel = require("../../classes/groups/class-group.model");
const { requiresManualGrading, computeAutoScore, computeMaxScore, computeIndicatorBreakdown } = require("./grading.utils");

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

// Shared by getLearnerIndicatorProgress (all-time) and getLearnerIndicatorProgressForAssessments
// (course-scoped) — sums each indicator's earned/possible marks across the given graded
// submissions and resolves each indicator's display name/competency.
async function summarizeIndicatorProgress(submissions) {
  const totals = new Map();
  submissions.forEach((s) => {
    (s.indicatorBreakdown || []).forEach(({ indicatorId, marksEarned, marksPossible }) => {
      const cur = totals.get(indicatorId) || { marksEarned: 0, marksPossible: 0 };
      cur.marksEarned += marksEarned;
      cur.marksPossible += marksPossible;
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
      marksPossible,
      percent: marksPossible > 0 ? Math.round((marksEarned / marksPossible) * 100) : 0,
    };
  }));

  return rows.sort((a, b) => a.competencyName.localeCompare(b.competencyName) || a.indicatorName.localeCompare(b.indicatorName));
}

// A standalone diagnostic issue carries either an ageCategoryId (Developmental Stage ->
// Performance Band placement) or a learningAreaId (Learning Area -> starting course
// placement) — never both. Ordinary class-issued assessments have neither, so this is a
// no-op for them.
// Propagates `updates` to every OTHER submission sharing this one's (issueId, groupId) — the
// mechanism behind "one submission per group": every sibling row stays an identical mirror of
// the group's shared attempt (answers on draft/submit, score+feedback+status on grade). A no-op
// for a submission with no groupId (an ordinary individual submission).
async function fanOutToGroup(submission, updates) {
  if (!submission.groupId) return;
  const siblings = await AssessmentSubmissionModel.findGroupSiblings(submission.issueId, submission.groupId);
  await Promise.all(
    siblings.filter((s) => s.id !== submission.id).map((s) => AssessmentSubmissionModel.update(s.id, updates))
  );
}

async function maybePlaceFromDiagnostic(submission) {
  if (submission.status !== "graded") return;
  const issue = await AssessmentIssueModel.findById(submission.issueId);
  if (!issue?.learnerId) return;
  const scorePercent = submission.maxScore > 0 ? (submission.totalScore / submission.maxScore) * 100 : 0;
  if (issue.ageCategoryId) {
    await CompetencyService.placeLearnerFromDiagnostic(issue.learnerId, issue.hubId, issue.ageCategoryId, scorePercent);
  } else if (issue.learningAreaId) {
    await CompetencyService.placeLearnerFromLearningAreaDiagnostic(issue.learnerId, issue.learningAreaId, scorePercent, issue.assessmentId);
  }
}

const AssessmentSubmissionService = {
  // Issuing is idempotent per (assessment, session, class) — re-issuing (e.g. after editing the
  // due date) updates the existing record instead of creating a duplicate that would otherwise
  // fragment a class's roster view across two issues of "the same" assessment.
  // groupMode is left undefined by a caller that only means to touch dueDate on a re-issue —
  // only an explicit true/false attempts to change it, and even then only while nobody's
  // started (see the guard below), since flipping it mid-flight would leave a mix of individual
  // and group-linked submission rows with no consistent meaning.
  async issueAssessment({ assessmentId, sessionId, courseId, classId, issuedBy, dueDate, groupMode }) {
    await loadAssessmentOrThrow(assessmentId);
    const existing = await AssessmentIssueModel.findOne({ assessmentId, sessionId, classId });
    if (existing) {
      const updates = { dueDate: dueDate ?? existing.dueDate };
      if (groupMode !== undefined && groupMode !== existing.groupMode) {
        const hasSubmissions = (await AssessmentSubmissionModel.findAll({ issueId: existing.id })).length > 0;
        if (hasSubmissions) {
          const err = new Error("Can't change group mode after learners have started this assessment");
          err.statusCode = 409;
          throw err;
        }
        updates.groupMode = groupMode;
      }
      return AssessmentIssueModel.update(existing.id, updates);
    }
    return AssessmentIssueModel.create({
      assessmentId, sessionId, courseId, classId, issuedBy, dueDate: dueDate || null, groupMode: groupMode || false,
    });
  },

  // Standalone diagnostic issuance — bypasses the normal course/session attachment entirely
  // (unlike issueAssessment above), since a diagnostic is meant to run before any course is
  // even assigned. Idempotent per (assessment, learner): re-triggering (e.g. re-enrolling)
  // never creates a duplicate. Pass exactly one of ageCategoryId/learningAreaId — which one is
  // set is what maybePlaceFromDiagnostic branches on at grading time. `hubId` is only ever set
  // alongside ageCategoryId — it's what lets maybePlaceFromDiagnostic write the resulting
  // stage/band placement back onto the correct hub enrollment once this is graded (see
  // CompetencyService.placeLearnerFromDiagnostic). See learner.service.js's
  // maybeAutoIssueDiagnostic for the caller(s).
  async issueDiagnostic({ assessmentId, learnerId, ageCategoryId = null, learningAreaId = null, hubId = null }) {
    await loadAssessmentOrThrow(assessmentId);
    const existing = await AssessmentIssueModel.findOneStandalone({ assessmentId, learnerId, learningAreaId, ageCategoryId });
    if (existing) return existing;
    return AssessmentIssueModel.create({
      assessmentId, learnerId, ageCategoryId, learningAreaId, hubId,
      sessionId: null, courseId: null, classId: null,
      issuedBy: "system", dueDate: null,
    });
  },

  // A learner has just finished every other section of a course session — see
  // SectionViewPage.jsx's areNonAssessmentSectionsComplete check, the client-side trigger for
  // this (there's no server-side course-progress tracking to fire it from instead). Same
  // "bypass class/session issuance" pattern as issueDiagnostic, but keyed to the course/session
  // that triggered it instead of an age category. Idempotent per (assessment, learner).
  async issueOnSessionComplete({ assessmentId, learnerId, courseId, sessionId }) {
    await loadAssessmentOrThrow(assessmentId);
    const existing = await AssessmentIssueModel.findOneStandalone({ assessmentId, learnerId });
    if (existing) return existing;
    return AssessmentIssueModel.create({
      assessmentId, learnerId, courseId, sessionId,
      classId: null, issuedBy: "system", dueDate: null,
    });
  },

  // Every standalone issue (diagnostic or course-progress-triggered) targeting this learner
  // directly, merged with their own submission — the learnerId-keyed counterpart to
  // getIssuedAssessmentsForLearner above, which is keyed by class instead.
  async getStandaloneIssuedAssessments(learnerId) {
    const issues = await AssessmentIssueModel.findAll({ learnerId });
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
    const standaloneRows = standalone.filter((row) => !row.issue.ageCategoryId && !row.issue.learningAreaId);
    return [...standaloneRows, ...classRows];
  },

  // This learner's most recent auto-issued diagnostic, if any — drives the "Diagnostic
  // Assessment" card on LearnerViewPage. Filtered to ageCategoryId specifically, since a
  // learner can now also hold course-progress-triggered standalone issues (see
  // issueOnSessionComplete above) that share the same learnerId-keyed issue shape. Optional
  // curriculumId narrows to the one belonging to that curriculum — a learner enrolled at
  // several hubs can hold a Stage diagnostic from each; the learner-portal's first-login gate
  // needs only the one for the hub it's currently gating (see FirstLoginDiagnosticGate.jsx).
  // Omitted, this preserves the old unscoped "first one found" behavior for LearnerViewPage's
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

  // Every Learning-Area diagnostic this learner currently holds (one per area their class's
  // courses expose, per learner.service.js's maybeAutoIssueDiagnostic) — plural counterpart to
  // getDiagnosticForLearner above, since a learner can hold several of these at once. Scoped to
  // two things so old housekeeping never blocks the first-login gate forever: (1) the area's
  // curriculum has to be one the learner is CURRENTLY actively enrolled under — an issue left
  // over from a hub/curriculum the learner has since moved on from is stale, not outstanding;
  // (2) the issue's assessmentId has to match the area's CURRENTLY configured
  // diagnosticAssessmentId — if an admin swaps which assessment an area uses for its
  // diagnostic, the learner's old issue against the previous assessment is stale too, not a
  // second diagnostic to take.
  async getLearningAreaDiagnosticsForLearner(learnerId) {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const activeLinks = links.filter((link) => link.status === "active" && link.classId);
    const activeClasses = await Promise.all(activeLinks.map((link) => ClassModel.findById(link.classId)));
    const activeCurriculumIds = new Set(activeClasses.map((c) => c?.curriculumId).filter(Boolean));

    const standalone = await AssessmentSubmissionService.getStandaloneIssuedAssessments(learnerId);
    const candidates = standalone.filter((row) => !!row.issue.learningAreaId);
    const results = await Promise.all(candidates.map(async (row) => {
      const area = await LearningAreaModel.findById(row.issue.learningAreaId);
      const matches = !!area && activeCurriculumIds.has(area.curriculumId) && area.diagnosticAssessmentId === row.issue.assessmentId;
      return matches ? row : null;
    }));
    return results.filter(Boolean);
  },

  async revokeIssue(issueId) {
    return AssessmentIssueModel.delete(issueId);
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
    const rows = await AssessmentSubmissionService._hydrateSubmissionRows(submissions);
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
  async getStandaloneSubmissionsNeedingGrading(classId) {
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const learnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);
    const allSubmitted = await AssessmentSubmissionModel.findAll({ status: "submitted" });
    const submissions = allSubmitted.filter((s) => !s.classId && learnerIds.includes(s.learnerId));
    return AssessmentSubmissionService._hydrateSubmissionRows(submissions);
  },

  // What a learner sees: every issue targeting their class, each merged with their own
  // submission (or a synthetic "not_started" placeholder if they haven't opened it yet).
  async getIssuedAssessmentsForLearner(classId, learnerId) {
    const issues = await AssessmentIssueModel.findAll({ classId });
    const rows = await Promise.all(issues.map(async (issue) => {
      const assessment = await AssessmentModel.findById(issue.assessmentId);
      const submission = await AssessmentSubmissionModel.findOne({ issueId: issue.id, learnerId });
      return {
        issue,
        assessment,
        submission: submission || { status: "not_started" },
      };
    }));
    return rows.filter((row) => !!row.assessment);
  },

  // Roster view for the teacher grading a class: every enrolled learner, each merged with their
  // submission (or "not_started"). Drives both the class-wide progress summary and the
  // per-learner grading action.
  async getRosterForIssue(issueId) {
    const issue = await AssessmentIssueModel.findById(issueId);
    if (!issue) {
      const err = new Error("Issue not found");
      err.statusCode = 404;
      throw err;
    }
    const assessment = await loadAssessmentOrThrow(issue.assessmentId);
    // classId/status no longer live on the learner record — resolve the roster via enrollment
    // links for this class instead (see learner-hub-link.model.js).
    const links = await LearnerHubLinkModel.findByClassId(issue.classId);
    const learnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);
    const learners = await LearnerModel.findAll({ ids: learnerIds });
    const submissions = await AssessmentSubmissionModel.findAll({ issueId });
    const submissionByLearner = new Map(submissions.map((s) => [s.learnerId, s]));

    const roster = learners.map((learner) => ({
      learner,
      submission: submissionByLearner.get(learner.id) || { status: "not_started" },
    }));

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

    if (!issue.groupMode) return AssessmentSubmissionModel.create(base);

    // Group mode: resolve this learner's class group. No group yet -> falls back to a normal
    // solo submission (groupId stays null) — not blocked, since locking a learner out over an
    // incomplete teacher setup would be worse; they simply show up as "ungrouped" in the roster.
    const group = await ClassGroupService.getGroupForLearner(issue.classId, learnerId);
    if (!group) return AssessmentSubmissionModel.create(base);

    const siblings = await AssessmentSubmissionModel.findGroupSiblings(issueId, group.id);
    if (!siblings.length) return AssessmentSubmissionModel.create({ ...base, groupId: group.id });

    // A later group member opening it for the first time — clone the group's current shared
    // state instead of starting them blank, so they see whatever progress/result already exists
    // rather than an empty form that would silently diverge from their teammates'.
    const sibling = siblings[0];
    return AssessmentSubmissionModel.create({
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
    const updated = await AssessmentSubmissionModel.update(submissionId, { answers });
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

    const assessment = await loadAssessmentOrThrow(submission.assessmentId);
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

    let updated;
    if (submission.groupId) {
      // Guards the race where two group members tap Submit at nearly the same instant: only the
      // first write actually lands (the row was still "in_progress"); the loser gets null back
      // and hits the same "already submitted" error a normal retry would.
      updated = await AssessmentSubmissionModel.updateIfInProgress(submissionId, updates);
      if (!updated) {
        const err = new Error("This assessment has already been submitted");
        err.statusCode = 400;
        throw err;
      }
      await fanOutToGroup(submission, updates);
    } else {
      updated = await AssessmentSubmissionModel.update(submissionId, updates);
    }
    await maybePlaceFromDiagnostic(updated);
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
    return graded;
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
    return AssessmentSubmissionModel.update(submissionId, {
      reportPublished: true,
      reportPublishedAt: new Date(),
      reportPublishedBy: publishedBy,
    });
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
  async getLearnerIndicatorProgress(learnerId, curriculumId = null) {
    let submissions = await AssessmentSubmissionModel.findAll({ learnerId, status: "graded" });
    if (curriculumId) {
      const assessmentIds = await CompetencyService.getAttachedAssessmentIds(curriculumId);
      submissions = submissions.filter((s) => assessmentIds.has(s.assessmentId));
    }
    return summarizeIndicatorProgress(submissions);
  },

  // Same aggregation, narrowed to one course's worth of assessments — the reports module's
  // "indicator breakdown within this course" view, reusing the exact indicator-resolution logic
  // above rather than duplicating it. Only counts assessments whose own report has already been
  // published to the learner — a course report shouldn't reveal a score the learner hasn't seen
  // released on its own assessment page yet.
  async getLearnerIndicatorProgressForAssessments(learnerId, assessmentIds) {
    const graded = await AssessmentSubmissionModel.findAll({ learnerId, status: "graded" });
    const submissions = graded.filter((s) => assessmentIds.includes(s.assessmentId) && s.reportPublished);
    return summarizeIndicatorProgress(submissions);
  },
};

module.exports = AssessmentSubmissionService;
