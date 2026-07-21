import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { assessmentSubmissionApi } from "../services/assessmentSubmissionApi";

const KEYS = {
  issuesForClass: (classId)   => ["assessment-issues", "byClass", classId],
  roster:         (issueId)   => ["assessment-issues", issueId, "roster"],
  issuedLearner:  ()          => ["assessment-issues", "learner-issued"],
  submission:     (id)        => ["assessment-submissions", id],
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
      toast.success("Grade saved — released to the learner");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to save grade"),
  });
}
