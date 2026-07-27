import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { assessmentSubmissionApi } from "../services/assessmentSubmissionApi";

const KEYS = {
  issuesForClass: (classId)   => ["assessment-issues", "byClass", classId],
  roster:         (issueId)   => ["assessment-issues", issueId, "roster"],
  issuedLearner:  ()          => ["assessment-issues", "learner-issued"],
  submission:     (id)        => ["assessment-submissions", id],
  diagnostic:     (learnerId) => ["assessment-issues", "diagnostic", learnerId],
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
      toast.success("Grade saved — released to the learner");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to save grade"),
  });
}
