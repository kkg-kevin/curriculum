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
