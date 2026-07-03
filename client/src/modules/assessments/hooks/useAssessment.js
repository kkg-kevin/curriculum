import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { assessmentApi } from "../services/assessmentApi";

export const ASSESSMENT_KEYS = {
  all: ["assessments"],
  detail: (id) => ["assessments", "detail", id],
};

export function useAssessmentsQuery() {
  return useQuery({
    queryKey: ASSESSMENT_KEYS.all,
    queryFn: () => assessmentApi.getAll(),
  });
}

export function useAssessmentQuery(id) {
  return useQuery({
    queryKey: ASSESSMENT_KEYS.detail(id),
    queryFn: () => assessmentApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assessmentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.all });
      toast.success("Assessment created successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create assessment");
    },
  });
}

export function useUpdateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => assessmentApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.detail(data.id) });
      toast.success("Assessment updated successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update assessment");
    },
  });
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assessmentApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.all });
      toast.success("Assessment deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete assessment");
    },
  });
}

function useAssessmentDetailMutation(mutationFn, { successMessage, errorMessage }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_data, variables) => {
      const assessmentId = Array.isArray(variables) ? variables[0] : variables.assessmentId;
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.detail(assessmentId) });
      toast.success(successMessage);
    },
    onError: (err) => toast.error(err.message || errorMessage),
  });
}

export function useAddItem() {
  return useAssessmentDetailMutation(
    ({ assessmentId, data }) => assessmentApi.addItem(assessmentId, data),
    { successMessage: "Question added", errorMessage: "Failed to add question" }
  );
}

export function useUpdateItem() {
  return useAssessmentDetailMutation(
    ({ assessmentId, itemId, data }) => assessmentApi.updateItem(assessmentId, itemId, data),
    { successMessage: "Question updated", errorMessage: "Failed to update question" }
  );
}

export function useDeleteItem() {
  return useAssessmentDetailMutation(
    ({ assessmentId, itemId }) => assessmentApi.removeItem(assessmentId, itemId),
    { successMessage: "Question deleted", errorMessage: "Failed to delete question" }
  );
}

export function useAddRubricCriterion() {
  return useAssessmentDetailMutation(
    ({ assessmentId, data }) => assessmentApi.addRubricCriterion(assessmentId, data),
    { successMessage: "Criterion added", errorMessage: "Failed to add criterion" }
  );
}

export function useUpdateRubricCriterion() {
  return useAssessmentDetailMutation(
    ({ assessmentId, criterionId, data }) => assessmentApi.updateRubricCriterion(assessmentId, criterionId, data),
    { successMessage: "Criterion updated", errorMessage: "Failed to update criterion" }
  );
}

export function useDeleteRubricCriterion() {
  return useAssessmentDetailMutation(
    ({ assessmentId, criterionId }) => assessmentApi.removeRubricCriterion(assessmentId, criterionId),
    { successMessage: "Criterion deleted", errorMessage: "Failed to delete criterion" }
  );
}
