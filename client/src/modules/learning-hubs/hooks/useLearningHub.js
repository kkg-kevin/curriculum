import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { learningHubApi } from "../services/learningHubApi";

export const LEARNING_HUB_KEYS = {
  all: ["learningHubs"],
  list: (filters) => ["learningHubs", "list", filters],
  detail: (id) => ["learningHubs", "detail", id],
};

export function useLearningHubsQuery() {
  const filters = useSelector((state) => state.learningHubs.filters);
  return useQuery({
    queryKey: LEARNING_HUB_KEYS.list(filters),
    queryFn: () => learningHubApi.getAll(filters),
  });
}

export function useAllLearningHubsQuery(params = {}) {
  return useQuery({
    queryKey: ["learningHubs", "all", params],
    queryFn: () => learningHubApi.getAll(params),
  });
}

export function useLearningHubQuery(id) {
  return useQuery({
    queryKey: LEARNING_HUB_KEYS.detail(id),
    queryFn: () => learningHubApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateLearningHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: learningHubApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEARNING_HUB_KEYS.all });
      toast.success("Learning hub created successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create learning hub"),
  });
}

export function useUpdateLearningHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => learningHubApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: LEARNING_HUB_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: LEARNING_HUB_KEYS.detail(data.id) });
      toast.success("Learning hub updated successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update learning hub"),
  });
}

export function useDeleteLearningHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: learningHubApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEARNING_HUB_KEYS.all });
      toast.success("Learning hub deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete learning hub"),
  });
}
