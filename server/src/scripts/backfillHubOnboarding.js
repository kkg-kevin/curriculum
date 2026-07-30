// One-time: learners who already cleared the (now-retired) learner-level onboarding flag
// should have every one of their current hub-links treated as already cleared too, so moving
// the first-login diagnostic gate to per-hub tracking doesn't re-gate anyone who's already
// been through the portal. New enrollments made after this runs simply won't have the field
// set, which is exactly what should re-trigger the gate for a genuinely new hub. Idempotent:
// only touches links missing the field, safe to re-run.
const LearnerModel = require("../modules/learners/learner.model");
const LearnerHubLinkModel = require("../modules/learners/learner-hub-link.model");

function run() {
  const learners = LearnerModel.findAll().filter((l) => l.portalOnboardingCompletedAt);
  let touched = 0;
  learners.forEach((l) => {
    LearnerHubLinkModel.findByLearnerId(l.id)
      .filter((link) => !link.onboardingCompletedAt)
      .forEach((link) => {
        LearnerHubLinkModel.update(link.id, { onboardingCompletedAt: l.portalOnboardingCompletedAt });
        touched++;
      });
  });
  console.log(`Backfilled ${touched} hub-link(s) across ${learners.length} already-onboarded learners.`);
}

run();
