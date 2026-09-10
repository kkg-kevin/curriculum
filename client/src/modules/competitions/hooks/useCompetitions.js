import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { competitionApi } from "../services/competitionApi";

export const COMPETITION_KEYS = {
  all:       ["competitions"],
  detail:    (id) => ["competitions", "detail", id],
  byProgram: (programId) => ["competitions", "byProgram", programId],
};

export function useCompetitionsQuery(params) {
  return useQuery({
    queryKey: params?.programId ? COMPETITION_KEYS.byProgram(params.programId) : COMPETITION_KEYS.all,
    queryFn: () => competitionApi.getAll(params),
  });
}

export function useCompetitionQuery(id) {
  return useQuery({
    queryKey: COMPETITION_KEYS.detail(id),
    queryFn: () => competitionApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competitionApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETITION_KEYS.all });
      toast.success("Competition created!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create competition"),
  });
}

export function useUpdateCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competitionApi.update(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: COMPETITION_KEYS.all });
      if (data?.id) qc.invalidateQueries({ queryKey: COMPETITION_KEYS.detail(data.id) });
      toast.success("Competition updated!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update competition"),
  });
}

export function useDeleteCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competitionApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETITION_KEYS.all });
      toast.success("Competition deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete competition"),
  });
}
