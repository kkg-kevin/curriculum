// Gives learners who enrolled in a bootcamp on the website before 30 Oct 2026 their developmental
// stage and pathway, which that enrolment used to leave out, then exits.
//   npm run bootcamps:place-learners            — only reports what it would do
//   npm run bootcamps:place-learners -- --apply — does it
//
// For each website bootcamp enrolment (a lead with a bootcampId and a learnerId): the pathway whose
// website diagnostic they took (the lead's "Diagnostic attempt: …" note), else the bootcamp's
// pathway for their stage or age — same rules as a new enrolment (placeOnBootcampPathway). A
// learner who already has a stage and a pathway placement is left alone. Safe to run again.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const BootcampModel = require("../modules/bootcamps/bootcamp.model");
const LearnerModel = require("../modules/learners/learner.model");
const LearnerHubLinkModel = require("../modules/learners/learner-hub-link.model");
const LearnerPathwayModel = require("../modules/curriculum/competency-framework/learner-pathway.model");
const { placeOnBootcampPathway } = require("../modules/bootcamp-enrollment/bootcamp-enrollment.service");
const { ageFrom } = require("../shared/utils/age");

const apply = process.argv.includes("--apply");

(async () => {
  const leads = await db("leads").whereNotNull("bootcampId").whereNotNull("learnerId").orderBy("createdAt");
  const counts = { checked: 0, alreadyPlaced: 0, placed: 0, noPathway: 0, missing: 0 };
  for (const lead of leads) {
    counts.checked += 1;
    const [learner, bootcamp] = await Promise.all([LearnerModel.findById(lead.learnerId), BootcampModel.findById(lead.bootcampId)]);
    const link = learner && lead.hubId ? await LearnerHubLinkModel.findOne(learner.id, lead.hubId) : null;
    if (!learner || !bootcamp || !link) { counts.missing += 1; continue; }
    const onPathway = (await LearnerPathwayModel.findByLearner(learner.id)).some((r) => r.curriculumId === bootcamp.curriculumId);
    if (link.currentStageId && onPathway) { counts.alreadyPlaced += 1; continue; }

    const attemptId = (String(lead.message || "").match(/Diagnostic attempt:\s*(\S+)/) || [])[1] || null;
    const age = ageFrom(learner.dateOfBirth) ?? (lead.learnerAge != null ? Number(lead.learnerAge) : null);
    const name = `${learner.firstName || ""} ${learner.lastName || ""}`.trim();
    if (!apply) {
      console.log(`would place: ${name} — ${bootcamp.name} (age ${age ?? "?"}${attemptId ? ", from their website diagnostic" : ""})`);
      continue;
    }
    const pathway = await placeOnBootcampPathway(learner.id, bootcamp, lead.hubId, { attemptId, age });
    if (pathway) {
      counts.placed += 1;
      console.log(`placed: ${name} — ${bootcamp.name} → ${pathway.name}`);
    } else {
      counts.noPathway += 1;
      console.log(`no pathway fits: ${name} — ${bootcamp.name} (age ${age ?? "?"})`);
    }
  }
  console.log(apply ? "Done:" : "Report only (add -- --apply to do it):", JSON.stringify(counts));
})()
  .catch((err) => {
    console.error("Placing bootcamp learners failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
