// Recounts every marked project with milestones (16 Nov 2026), then exits.
//   npm run projects:recount-milestones            — only reports what it would change
//   npm run projects:recount-milestones -- --apply — changes it
//
// A project's maximum always counted its milestones' points, but its marked score didn't add the
// milestone marks — so a project with 30/30 on milestones and 18/20 on its rubric read 18/50. Marking
// now adds them (grading.utils.js's milestoneEarned); this puts the projects marked before right:
// each one's score (auto + manual + milestones) and skills, then that learner's session report is
// rebuilt from it (no new report, so nobody is notified). Safe to run again — an unchanged project
// is left alone. A course's final report already published keeps what it said; republishing it
// (the educator's Publish) picks the new figures up.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const AssessmentModel = require("../modules/assessments/assessment.model");
const AssessmentSubmissionModel = require("../modules/assessments/submissions/assessment-submission.model");
const AssessmentIssueModel = require("../modules/assessments/submissions/assessment-issue.model");
const { computeEntryMarks } = require("../modules/assessments/assessment.utils");
const { milestoneEarned, computeIndicatorBreakdown } = require("../modules/assessments/submissions/grading.utils");

const apply = process.argv.includes("--apply");
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

(async () => {
  const counts = { projects: 0, marked: 0, changed: 0, reportsRebuilt: 0 };
  const projects = (await db("assessments").where({ type: "project" }).select("id")).map((r) => r.id);
  for (const id of projects) {
    const assessment = await AssessmentModel.findById(id);
    const worth = (assessment?.milestones || []).reduce((s, m) => s + computeEntryMarks(m), 0);
    if (!worth) continue;
    counts.projects += 1;
    const rows = await db("assessment_submissions").where({ assessmentId: id, status: "graded" }).select("id");
    for (const { id: subId } of rows) {
      const s = await AssessmentSubmissionModel.findById(subId);
      if (!s) continue;
      counts.marked += 1;
      const total = round1((Number(s.autoScore) || 0) + (Number(s.manualScore) || 0) + milestoneEarned(assessment, s.milestoneProgress));
      if (total === round1(s.totalScore)) continue;
      counts.changed += 1;
      console.log(`${apply ? "" : "would "}recount: "${assessment.name}" — learner ${s.learnerId}: ${round1(s.totalScore)} → ${total} of ${s.maxScore}`);
      if (!apply) continue;
      await AssessmentSubmissionModel.update(s.id, {
        totalScore: total,
        indicatorBreakdown: computeIndicatorBreakdown(assessment, s.autoItemResults, s.itemFeedback, s.milestoneProgress),
      });
      // Its session report, from the class issue it answers (a reissue's is its original class's).
      const issue = await AssessmentIssueModel.findById(s.issueId);
      if (!issue) continue;
      const classId = issue.classId || await require("../modules/assessments/submissions/assessment-submission.service").classIdForIssue(issue);
      if (!classId || !issue.courseId) continue;
      await require("../modules/reports/report.service").refreshSessionReportsForAssessment({
        classId, courseId: issue.courseId, sessionId: issue.sessionId || null, assessmentId: id, learnerIds: [s.learnerId],
      });
      counts.reportsRebuilt += 1;
    }
  }
  console.log(apply ? "Done:" : "Report only (add -- --apply to do it):", JSON.stringify(counts));
})()
  .catch((err) => {
    console.error("Recounting projects failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
