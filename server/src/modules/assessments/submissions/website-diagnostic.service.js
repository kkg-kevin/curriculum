const db = require("../../../config/db");
const AssessmentIssueModel = require("./assessment-issue.model");
const AssessmentSubmissionModel = require("./assessment-submission.model");
const AssessmentModel = require("../assessment.model");
const PublicDiagnosticAttemptModel = require("../../public-site/public-diagnostic-attempt.model");
const PathwayModel = require("../../curriculum/competency-framework/pathway.model");
const LearnerPathwayModel = require("../../curriculum/competency-framework/learner-pathway.model");
const AgeCategoryModel = require("../../curriculum/competency-framework/age-category.model");
const PerformanceBandModel = require("../../curriculum/competency-framework/performance-band.model");
const CompetencyModel = require("../../settings/competencies/competency.model");
const CourseModel = require("../../courses/course.model");

// The diagnostic a child takes on the website before enrolling, made part of their learner record
// once they're enrolled — so it counts exactly like one taken in the portal:
//   - an issue (issuedBy "website", publicAttemptId = the attempt, pathwayId = its pathway) and a
//     marked submission copied from the attempt (answers, item results, score, indicator marks —
//     graded on the website with the same grading.utils as the portal), report released;
//   - its indicator marks then feed the learner's competencies, Progress Arc and pathway progress
//     (getLearnerIndicatorProgress counts a curriculum's diagnostics), and the profile's
//     diagnostic report (reportsForLearner below) shows it;
//   - placement: a bootcamp enrolment places from it already (placeOnBootcampPathway); staff
//     linking one by hand place from it here (attach).
// Nothing is copied twice: one issue per learner and attempt.

const phoneKey = (phone) => String(phone || "").replace(/\D/g, "").slice(-9);

const WebsiteDiagnosticService = {
  // Copies the attempt onto the learner. Returns { issue, submission, created } — or null for an
  // unknown attempt.
  async record(learnerId, attemptId) {
    const attempt = attemptId ? await PublicDiagnosticAttemptModel.findById(attemptId) : null;
    if (!attempt) return null;
    const existing = await db("assessment_issues").where({ learnerId, publicAttemptId: attempt.id }).first();
    if (existing) {
      return { issue: existing, submission: await AssessmentSubmissionModel.findOne({ issueId: existing.id, learnerId }), created: false, attempt };
    }
    const takenAt = new Date(attempt.createdAt);
    const issue = await AssessmentIssueModel.create({
      assessmentId: attempt.assessmentId, learnerId, pathwayId: attempt.pathwayId, ageCategoryId: null, hubId: null,
      sessionId: null, courseId: null, classId: null, issuedBy: "website", dueDate: null, publicAttemptId: attempt.id,
    });
    const submission = await AssessmentSubmissionModel.create({
      issueId: issue.id, assessmentId: attempt.assessmentId, learnerId, classId: null,
      status: "graded",
      answers: attempt.answers || [],
      autoScore: attempt.totalScore, autoMax: attempt.maxScore, autoItemResults: attempt.itemResults || [],
      manualScore: null, totalScore: attempt.totalScore, maxScore: attempt.maxScore,
      requiresManualGrading: false,
      itemFeedback: [], overallFeedback: "",
      indicatorBreakdown: attempt.indicatorBreakdown || [],
      submittedAt: takenAt, gradedAt: takenAt, gradedBy: null,
      reportPublished: true, reportPublishedAt: takenAt, reportPublishedBy: null,
    });
    return { issue, submission, created: true, attempt };
  },

  // Staff linking a website diagnostic to a learner they added themselves (the family enquired
  // after the diagnostic instead of enrolling online): copied, then placed from — the pathway's
  // course for the score, like a diagnostic marked in the portal, and the one-diagnostic rule
  // withdraws any un-started system diagnostic there.
  async attach(learnerId, attemptId) {
    const recorded = await WebsiteDiagnosticService.record(learnerId, attemptId);
    if (!recorded) throw Object.assign(new Error("Website diagnostic not found"), { statusCode: 404 });
    const { attempt } = recorded;
    const scorePercent = Number(attempt.maxScore) > 0 ? (Number(attempt.totalScore) / Number(attempt.maxScore)) * 100 : 0;
    const CompetencyService = require("../../curriculum/competency-framework/competency.service");
    await CompetencyService.placeLearnerFromPathwayDiagnostic(learnerId, attempt.pathwayId, scorePercent, attempt.assessmentId).catch(() => null);
    const LearnerService = require("../../learners/learner.service");
    const links = await db("learner_hub_links").where({ learnerId }).whereNotNull("classId");
    for (const link of links) await LearnerService.ensureDiagnosticsIssued(learnerId, link.hubId);
    return recorded;
  },

  // The website diagnostics staff can link to this learner: those taken under the guardian's phone
  // (a diagnostic's enquiry keeps the parent's phone, not an email) and the one their bootcamp
  // enrolment came from — minus any already linked to a different learner.
  async candidatesFor(learner) {
    const key = phoneKey(learner?.guardianPhone);
    const leadIds = new Set();
    if (key.length >= 7) {
      const leads = await db("leads").where({ source: "diagnostic" }).whereNotNull("phone").select("id", "phone");
      leads.filter((l) => phoneKey(l.phone) === key).forEach((l) => leadIds.add(l.id));
    }
    const attempts = leadIds.size ? await db("public_diagnostic_attempts").whereIn("leadId", [...leadIds]).orderBy("createdAt", "desc") : [];
    const enrolment = await db("leads").where({ learnerId: learner.id }).whereNotNull("bootcampId").first("message");
    const fromEnrolment = (String(enrolment?.message || "").match(/Diagnostic attempt:\s*(\S+)/) || [])[1];
    if (fromEnrolment && !attempts.some((a) => a.id === fromEnrolment)) {
      const row = await db("public_diagnostic_attempts").where({ id: fromEnrolment }).first();
      if (row) attempts.unshift(row);
    }
    if (!attempts.length) return [];
    const issues = await db("assessment_issues").whereIn("publicAttemptId", attempts.map((a) => a.id)).select("learnerId", "publicAttemptId");
    const out = [];
    for (const attempt of attempts) {
      const linkedTo = issues.filter((i) => i.publicAttemptId === attempt.id).map((i) => i.learnerId);
      if (linkedTo.length && !linkedTo.includes(learner.id)) continue;
      const pathway = await PathwayModel.findById(attempt.pathwayId);
      out.push({
        attemptId: attempt.id, childName: attempt.childName || null, childAge: attempt.childAge ?? null,
        pathwayName: pathway?.name || "Pathway", takenAt: attempt.createdAt,
        totalScore: Number(attempt.totalScore), maxScore: Number(attempt.maxScore),
        linked: linkedTo.includes(learner.id),
      });
    }
    return out;
  },

  // The profile's diagnostic report: every MARKED diagnostic this learner holds, newest first,
  // optionally only those of one curriculum — a pathway's (taken on the website or in the portal)
  // or an older Developmental Stage one (no longer issued, but its result stays on the record) —
  // score, where it placed them, and the marks per competency with their indicators.
  async reportsForLearner(learnerId, curriculumId = null) {
    const issues = await db("assessment_issues").where({ learnerId }).where((q) => q.whereNotNull("pathwayId").orWhereNotNull("ageCategoryId"));
    if (!issues.length) return [];
    const competencies = await CompetencyModel.findAll();
    const indicatorMeta = new Map();
    competencies.forEach((c) => (c.indicators || []).forEach((i) => indicatorMeta.set(i.id, { name: i.name, competencyId: c.id, competencyName: c.name })));
    const journeys = await LearnerPathwayModel.findByLearner(learnerId);

    const reports = [];
    for (const issue of issues) {
      const submission = await AssessmentSubmissionModel.findOne({ issueId: issue.id, learnerId });
      if (submission?.status !== "graded") continue;
      const pathway = issue.pathwayId ? await PathwayModel.findById(issue.pathwayId) : null;
      const stage = !issue.pathwayId && issue.ageCategoryId ? await AgeCategoryModel.findById(issue.ageCategoryId) : null;
      const owner = pathway || stage;
      if (!owner || (curriculumId && owner.curriculumId !== curriculumId)) continue;
      const assessment = await AssessmentModel.findById(issue.assessmentId);

      const byCompetency = new Map();
      for (const row of submission.indicatorBreakdown || []) {
        const meta = indicatorMeta.get(row.indicatorId);
        const key = meta?.competencyId || "other";
        if (!byCompetency.has(key)) byCompetency.set(key, { competencyId: meta?.competencyId || null, name: meta?.competencyName || "Other", marksEarned: 0, marksPossible: 0, indicators: [] });
        const bucket = byCompetency.get(key);
        bucket.marksEarned += Number(row.marksEarned) || 0;
        bucket.marksPossible += Number(row.marksPossible) || 0;
        bucket.indicators.push({ indicatorId: row.indicatorId, name: meta?.name || "Indicator", marksEarned: Number(row.marksEarned) || 0, marksPossible: Number(row.marksPossible) || 0 });
      }
      const percent = (earned, possible) => (possible > 0 ? Math.round((earned / possible) * 100) : 0);

      // Where it placed them: a pathway's course (its placement history), or a stage's band (the
      // hub enrolment it was issued for).
      const journey = pathway ? journeys.find((j) => j.pathwayId === issue.pathwayId) : null;
      const placement = (journey?.history || []).filter((h) => h.reason === "diagnostic" && (!h.assessmentId || h.assessmentId === issue.assessmentId)).pop();
      const placedCourse = placement?.courseId ? await CourseModel.findById(placement.courseId) : null;
      let placedBand = null;
      if (stage) {
        const link = issue.hubId ? await db("learner_hub_links").where({ learnerId, hubId: issue.hubId }).first("currentStageId", "currentBandId") : null;
        if (link?.currentStageId === stage.id && link.currentBandId) placedBand = await PerformanceBandModel.findById(link.currentBandId);
      }

      reports.push({
        issueId: issue.id,
        source: issue.issuedBy === "website" ? "website" : "portal",
        kind: pathway ? "pathway" : "stage",
        pathwayId: pathway?.id || null, pathwayName: pathway ? pathway.name : `${stage.name} — developmental stage`, curriculumId: owner.curriculumId,
        assessmentName: assessment?.name || "Diagnostic",
        takenAt: submission.submittedAt || submission.gradedAt,
        totalScore: Number(submission.totalScore) || 0, maxScore: Number(submission.maxScore) || 0,
        percent: percent(Number(submission.totalScore) || 0, Number(submission.maxScore) || 0),
        placedCourseName: placedCourse?.name || null,
        placedBandName: placedBand?.name || null,
        competencies: [...byCompetency.values()].map((c) => ({
          ...c,
          marksEarned: Math.round(c.marksEarned * 100) / 100,
          percent: percent(c.marksEarned, c.marksPossible),
          indicators: c.indicators.map((i) => ({ ...i, percent: percent(i.marksEarned, i.marksPossible) })),
        })),
      });
    }
    return reports.sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
  },
};

module.exports = WebsiteDiagnosticService;
