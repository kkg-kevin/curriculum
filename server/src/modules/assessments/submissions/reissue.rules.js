// When a learner may be given another attempt at a class issue — the one rule the server enforces
// (AssessmentSubmissionService.reissueBlocker) and sends on each roster row (getRosterForIssue), so
// the roster's pickers never disagree with what the server will accept. Pure; tested in
// test/reissue.test.js.
//
// `attempts` is the learner's attempts oldest first — the class issue, then each reissue — each
// { submission } with submission { status: "not_started" } when they haven't opened it.
// Returns why they can't be reissued it now, or null when they can.
function reissueBlockerFrom({ groupMode = false, revoked = false, inClass = true, issuedToThem = true, attempts = [] }) {
  if (groupMode) return "Group assessments can't be reissued to one learner";
  if (revoked) return "Revoked for them — give it back first";
  if (!inClass) return "No longer in this class";
  if (!issuedToThem) return "It wasn't issued to them";
  if (!attempts.length) return "Hasn't handed it in yet — it's still open to them";
  const firstAttempt = attempts.length === 1;
  const submission = attempts[attempts.length - 1].submission || { status: "not_started" };
  if (submission.groupId) return "Group work can't be reissued to one learner";
  if (submission.status === "not_started") return firstAttempt ? "Hasn't handed it in yet — it's still open to them" : "Already reissued — waiting for them to do it";
  if (submission.status === "in_progress") return firstAttempt ? "Hasn't handed it in yet — it's still open to them" : "Already reissued — they've started it";
  if (submission.status !== "graded") return "Mark their latest attempt first";
  return null;
}

module.exports = { reissueBlockerFrom };
