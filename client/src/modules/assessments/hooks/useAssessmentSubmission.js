import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { assessmentSubmissionApi } from "../services/assessmentSubmissionApi";

const KEYS = {
  issuesForClass: (classId)   => ["assessment-issues", "byClass", classId],
  roster:         (issueId)   => ["assessment-issues", issueId, "roster"],
  issuedLearner:  ()          => ["assessment-issues", "learner-issued"],
  submission:     (id)        => ["assessment-submissions", id],
  diagnostic:     (learnerId) => ["assessment-issues", "diagnostic", learnerId],
  indicatorProgress: (learnerId) => ["assessment-issues", "indicator-progress", learnerId],
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

export function useRosterForIssue(issueId) {
  return useQuery({
    queryKey: KEYS.roster(issueId),
    queryFn:  () => assessmentSubmissionApi.getRoster(issueId),
    enabled:  !!issueId,
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
  return useMutation({
    mutationFn: assessmentSubmissionApi.getOrCreateSubmission,
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to start assessment"),
  });
}

export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers }) => assessmentSubmissionApi.saveDraft(id, answers),
    onSuccess: (submission) => qc.setQueryData(KEYS.submission(submission.id), submission),
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
      toast.success(submission.status === "graded" ? "Submitted — graded automatically!" : "Submitted — your teacher will grade it soon");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to submit"),
  });
}

// Admin/school-facing: a specific learner's auto-issued diagnostic (standalone, no class
// involved) — drives the Diagnostic Assessment card on LearnerViewPage.
export function useDiagnosticForLearner(learnerId) {
  return useQuery({
    queryKey: KEYS.diagnostic(learnerId),
    queryFn:  () => assessmentSubmissionApi.getDiagnosticForLearner(learnerId),
    enabled:  !!learnerId,
  });
}

// A learner's accumulating competency progress — sums earned/possible marks per indicator
// across every graded assessment they've ever had (see CompetencyService's
// getLearnerIndicatorProgress). Usable by the learner themselves or an admin/school reviewing it.
export function useLearnerIndicatorProgress(learnerId) {
  return useQuery({
    queryKey: KEYS.indicatorProgress(learnerId),
    queryFn:  () => assessmentSubmissionApi.getLearnerIndicatorProgress(learnerId),
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
      // A graded diagnostic may have just set this learner's currentStageId/currentBandId
      // server-side (see CompetencyService.placeLearnerFromDiagnostic) — refresh their record
      // so LearnerViewPage reflects the new placement without a manual reload.
      if (submission.learnerId) qc.invalidateQueries({ queryKey: ["learners", "detail", submission.learnerId] });
      // A class-issued submission's grade now stays hidden until the teacher separately
      // publishes its report (see publishReport in assessment-submission.service.js) — a
      // standalone one (diagnostic/course-progress) still releases the same instant it's graded.
      toast.success(submission.classId ? "Grade saved — click Create Report to release it to the learner" : "Grade saved — released to the learner");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to save grade"),
  });
}

// Releases an already-graded, class-issued submission's score/feedback to the learner — a
// separate step from grading itself (see GradingPanel's "Save & Release Grade" vs. the roster
// page's "Create Report" action).
export function usePublishSubmissionReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentSubmissionApi.publishReport,
    onSuccess: (submission) => {
      qc.setQueryData(KEYS.submission(submission.id), submission);
      qc.invalidateQueries({ queryKey: ["assessment-issues"] });
      toast.success("Report published — the learner can now see their grade");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to publish report"),
  });
}
