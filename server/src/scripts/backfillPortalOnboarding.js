// One-time backfill for the learner-portal first-login diagnostic gate: every learner that
// already existed before this feature shipped should be treated as already onboarded (they've
// been using the portal, this isn't their "first login") — only genuinely new learner accounts
// created from now on should ever see the gate. Idempotent: only touches records missing the
// field, safe to re-run.
const LearnerModel = require("../modules/learners/learner.model");

function run() {
  const all = LearnerModel.findAll();
  const missing = all.filter((l) => !l.portalOnboardingCompletedAt);
  const now = new Date().toISOString();
  missing.forEach((l) => LearnerModel.update(l.id, { portalOnboardingCompletedAt: now }));
  console.log(`Backfilled ${missing.length} of ${all.length} learners as already onboarded.`);
}

run();
