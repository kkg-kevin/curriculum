// Adds the website diagnostic to the record of every learner who enrolled in a bootcamp on the
// website after taking one (before 30 Oct 2026 it only placed them), then exits.
//   npm run diagnostics:link-website            — only reports what it would do
//   npm run diagnostics:link-website -- --apply — does it
//
// The diagnostic is the one their enrolment came from (the lead's "Diagnostic attempt: …" note).
// It's copied as a marked diagnostic (website-diagnostic.service.js), so its report and
// competencies show on the profile. Placement isn't redone — their enrolment already placed them.
// Safe to run again: a diagnostic already on the learner's record is skipped.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const WebsiteDiagnosticService = require("../modules/assessments/submissions/website-diagnostic.service");

const apply = process.argv.includes("--apply");

(async () => {
  const counts = { enrolments: 0, linked: 0, alreadyLinked: 0, missing: 0 };
  const leads = await db("leads").whereNotNull("bootcampId").whereNotNull("learnerId").where("message", "like", "%Diagnostic attempt:%");
  for (const lead of leads) {
    counts.enrolments += 1;
    const attemptId = (String(lead.message).match(/Diagnostic attempt:\s*(\S+)/) || [])[1];
    const [learner, attempt] = await Promise.all([
      db("learners").where({ id: lead.learnerId }).first("id", "firstName", "lastName"),
      attemptId ? db("public_diagnostic_attempts").where({ id: attemptId }).first("id", "totalScore", "maxScore") : null,
    ]);
    if (!learner || !attempt) { counts.missing += 1; continue; }
    if (await db("assessment_issues").where({ learnerId: learner.id, publicAttemptId: attempt.id }).first("id")) { counts.alreadyLinked += 1; continue; }
    const name = `${learner.firstName || ""} ${learner.lastName || ""}`.trim();
    console.log(`${apply ? "added" : "would add"}: ${name} — website diagnostic ${attempt.totalScore}/${attempt.maxScore}`);
    if (apply) await WebsiteDiagnosticService.record(learner.id, attempt.id);
    counts.linked += 1;
  }
  console.log(apply ? "Done:" : "Report only (add -- --apply to do it):", JSON.stringify(counts));
})()
  .catch((err) => {
    console.error("Linking website diagnostics failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
