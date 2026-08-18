import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { assessmentSubmissionApi } from "../services/assessmentSubmissionApi";

const KEYS = {
  issuesForClass: (classId)   => ["assessment-issues", "byClass", classId],
  roster:         (issueId)   => ["assessment-issues", issueId, "roster"],
  issuedLearner:  ()          => ["assessment-issues", "learner-issued"],
  submission:     (id)        => ["assessment-submissions", id],
  diagnostic:     (learnerId, curriculumId) => ["assessment-issues", "diagnostic", learnerId, curriculumId || null],
  learningAreaDiagnostics: (learnerId) => ["assessment-issues", "diagnostic", "learning-areas", learnerId],
  indicatorProgress: (learnerId, curriculumId) => ["assessment-issues", "indicator-progress", learnerId, curriculumId || null],
};

export function useIssueAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentSubmissionApi.issue,
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: KEYS.issuesForClass(issue.classId) });
      toast.success("Assessment issued to the class");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to issue assessment"),
  });
}

export function useIssuesForClass(classId) {
  return useQuery({
    queryKey: KEYS.issuesForClass(classId),
    queryFn:  () => assessmentSubmissionApi.getIssuesForClass(classId),
    enabled:  !!classId,
  });
}

// A teacher sits on this roster waiting for learners to submit — submission happens in a
// completely different browser session (the learner's own), so nothing in that mutation's
// onSuccess (useSubmitAssessment above) can reach into this teacher's cache to invalidate it.
// Without staleTime:0 this silently served up to the global 5-minute cache (see main.jsx's
// QueryClient defaults) even across a full navigate-away-and-back, which read as "I have to
// reload the page to see a submission." refetchInterval keeps it current while the teacher
// just sits on the page too, not only on remount/refocus.
export function useRosterForIssue(issueId) {
  return useQuery({
    queryKey: KEYS.roster(issueId),
    queryFn:  () => assessmentSubmissionApi.getRoster(issueId),
    enabled:  !!issueId,
    staleTime: 0,
    refetchInterval: 20_000,
  });
}

export function useRevokeIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentSubmissionApi.revokeIssue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment-issues"] });
      toast.success("Issue revoked");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to revoke"),
  });
}

export function useIssuedForLearner() {
  return useQuery({
    queryKey: KEYS.issuedLearner(),
    queryFn:  () => assessmentSubmissionApi.getIssuedForLearner(),
  });
}

export function useStartSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentSubmissionApi.getOrCreateSubmission,
    onSuccess: (submission) => {
      qc.setQueryData(KEYS.submission(submission.id), submission);
      // Without this, "My Assessments" (and any other mount of this same query) keeps showing
      // the pre-start "Not Started"/"Start" placeholder — getOrCreateSubmission is idempotent
      // server-side so no progress is actually lost, but the learner sees a stale card that
      // looks like nothing was saved and reads as "I have to start over."
      qc.invalidateQueries({ queryKey: KEYS.issuedLearner() });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to start assessment"),
  });
}

// Teacher-initiated counterpart to useStartSubmission, for Teacher Observation assessments only
// — the teacher opens/creates the submission themselves (see AssessmentRosterPage.jsx's "Begin
// Observation" flow) rather than waiting on a learner who never has anything to open. No roster
// invalidation on success: the fresh submission is still "in_progress" with nothing graded yet,
// so the caller holds it in local state until grading (useGradeSubmission) hands back the real,
// persisted row and invalidates the roster query itself.
export function useStartObservationSubmission() {
  return useMutation({
    mutationFn: ({ issueId, learnerId }) => assessmentSubmissionApi.startObservation(issueId, learnerId),
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to begin observation"),
  });
}

// Grades one milestone of a project assessment — independent of the submission's own
// draft/submit/grade flow (useSaveDraft/useSubmitAssessment/useGradeSubmission above), so this
// invalidates the same broad set useGradeSubmission does: the roster/needs-grading queues (in
// case a milestone-graded project ever needs to surface there later) and the learner's own list,
// since each milestone is visible to the learner the instant it's graded.
export function useGradeMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, milestoneId, learnerId, marks, feedback }) =>
      assessmentSubmissionApi.gradeMilestone(issueId, milestoneId, { learnerId, marks, feedback }),
    onSuccess: (submission) => {
      qc.setQueryData(KEYS.submission(submission.id), submission);
      qc.invalidateQueries({ queryKey: ["assessment-issues"] });
      qc.invalidateQueries({ queryKey: ["assessment-submissions"] });
      toast.success("Milestone graded — visible to the learner now");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to grade milestone"),
  });
}

// A teacher reissuing a graded assessment to one learner who didn't perform well — creates a
// brand new issue (see reissueToLearner's comment server-side), so this invalidates the same
// broad set useGradeMilestone does: it needs to show up both in the teacher's own issue lists
// and in the learner's "My Assessments" the moment it's created.
export function useReissueAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, learnerId, dueDate }) => assessmentSubmissionApi.reissue(issueId, { learnerId, dueDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment-issues"] });
      qc.invalidateQueries({ queryKey: ["assessment-submissions"] });
      toast.success("Assessment reissued — the learner will see it as a fresh attempt");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to reissue assessment"),
  });
}

export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers }) => assessmentSubmissionApi.saveDraft(id, answers),
    onSuccess: (submission) => {
      qc.setQueryData(KEYS.submission(submission.id), submission);
      // Same gap as useStartSubmission above — without this, a saved draft's answers exist on
      // the server but "My Assessments" (and a freshly (re)mounted detail page, which reads the
      // exact same shared query cache) keep showing whatever was cached before this save.
      qc.invalidateQueries({ queryKey: KEYS.issuedLearner() });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to save"),
  });
}

export function useSubmitAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers }) => assessmentSubmissionApi.submit(id, answers),
    onSuccess: (submission) => {
      qc.setQueryData(KEYS.submission(submission.id), submission);
      qc.invalidateQueries({ queryKey: KEYS.issuedLearner() });
      // Covers both KEYS.diagnostic(learnerId) and KEYS.learningAreaDiagnostics(learnerId) —
      // a submitted diagnostic needs to drop out of the first-login gate's outstanding list
      // immediately, not just after the next full page load.
      qc.invalidateQueries({ queryKey: ["assessment-issues", "diagnostic"] });
      toast.success(submission.status === "graded" ? "Submitted — graded automatically!" : "Submitted — your teacher will grade it soon");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to submit"),
  });
}

// A specific learner's auto-issued Stage diagnostic (standalone, no class involved) — drives
// the Diagnostic Assessment card on LearnerViewPage (unscoped there, matching its single-hub
// view), and the learner-portal's first-login gate (curriculumId passed so a Stage diagnostic
// from a different hub never leaks into the wrong hub's gate).
export function useDiagnosticForLearner(learnerId, curriculumId = null) {
  return useQuery({
    queryKey: KEYS.diagnostic(learnerId, curriculumId),
    queryFn:  () => assessmentSubmissionApi.getDiagnosticForLearner(learnerId, curriculumId),
    enabled:  !!learnerId,
  });
}

// Plural counterpart — every Learning-Area diagnostic this learner currently holds, drives the
// per-area diagnostic cards on LearnerViewPage.
export function useLearningAreaDiagnosticsForLearner(learnerId) {
  return useQuery({
    queryKey: KEYS.learningAreaDiagnostics(learnerId),
    queryFn:  () => assessmentSubmissionApi.getLearningAreaDiagnosticsForLearner(learnerId),
    enabled:  !!learnerId,
  });
}

// A learner's accumulating competency progress — sums earned/possible marks per indicator
// across every graded assessment they've ever had (see CompetencyService's
// getLearnerIndicatorProgress). Usable by the learner themselves or an admin/school reviewing it.
// Optional curriculumId narrows this to one curriculum's reachable assessments — pass the
// active hub's curriculumId so a learner enrolled at several hubs doesn't see another hub's
// indicator marks bleed into this one's Competencies tab.
export function useLearnerIndicatorProgress(learnerId, curriculumId = null) {
  return useQuery({
    queryKey: KEYS.indicatorProgress(learnerId, curriculumId),
    queryFn:  () => assessmentSubmissionApi.getLearnerIndicatorProgress(learnerId, curriculumId),
    enabled:  !!learnerId,
  });
}

export function useSubmissionQuery(id) {
  return useQuery({
    queryKey: KEYS.submission(id),
    queryFn:  () => assessmentSubmissionApi.getSubmission(id),
    enabled:  !!id,
  });
}

export function useGradeSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => assessmentSubmissionApi.grade(id, payload),
    onSuccess: (submission) => {
      qc.setQueryData(KEYS.submission(submission.id), submission);
      qc.invalidateQueries({ queryKey: ["assessment-issues"] });
      // AssessmentsPage.jsx's "Needs Grading" queue (both the plain and diagnostic variants) is
      // keyed ["assessment-submissions", "needs-grading"/"diagnostics-needing-grading", classId]
      // — a different top-level prefix from "assessment-issues" above, so without this a just-
      // graded row silently stayed listed as pending until a full page reload.
      qc.invalidateQueries({ queryKey: ["assessment-submissions"] });
      // A graded diagnostic may have just set this learner's currentStageId/currentBandId
      // server-side (see CompetencyService.placeLearnerFromDiagnostic) — refresh their record
      // so LearnerViewPage reflects the new placement without a manual reload.
      if (submission.learnerId) qc.invalidateQueries({ queryKey: ["learners", "detail", submission.learnerId] });
      // A graded Learning-Area diagnostic may have just placed this learner at a starting
      // course (see CompetencyService.placeLearnerFromLearningAreaDiagnostic) — no cheap way to
      // know which (curriculumId, learnerId) pair from here, so invalidate every Learning
      // Journey query rather than skip the refresh.
      qc.invalidateQueries({ queryKey: ["learning-journey"] });
      toast.success("Grade saved — released to the learner");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to save grade"),
  });
}
