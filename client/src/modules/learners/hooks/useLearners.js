import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { learnerApi } from "../services/learnerApi";

export const LEARNER_KEYS = {
  all:    ["learners"],
  detail: (id)      => ["learners", "detail", id],
};

export function useAllLearnersQuery() {
  return useQuery({
    queryKey: ["learners", "all"],
    queryFn:  () => learnerApi.getAll({}),
  });
}

export function useLearnerQuery(id) {
  return useQuery({
    queryKey: LEARNER_KEYS.detail(id),
    queryFn:  () => learnerApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateLearner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: learnerApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.all });
      toast.success("Learner enrolled successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to enroll learner"),
  });
}

export function useUpdateLearner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => learnerApi.update(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.all });
      if (data?.id) qc.invalidateQueries({ queryKey: LEARNER_KEYS.detail(data.id) });
      toast.success("Learner updated successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to update learner"),
  });
}

export function useDeleteLearner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: learnerApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.all });
      toast.success("Learner removed");
    },
    onError: (err) => toast.error(err.message || "Failed to remove learner"),
  });
}
