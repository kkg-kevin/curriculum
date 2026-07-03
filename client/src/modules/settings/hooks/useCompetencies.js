import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { competenciesApi } from "../services/competenciesApi";

const STALE = 5 * 60 * 1000;

export const COMPETENCY_KEYS = {
  comps:      ["settings", "competencies"],
  indicators: (compId) => ["settings", "competency-indicators", compId],
};

/* ── Competencies ───────────────────────────────────────────────────────── */

export function useCompetencies() {
  return useQuery({
    queryKey:  COMPETENCY_KEYS.comps,
    queryFn:   competenciesApi.getCompetencies,
    staleTime: STALE,
  });
}

export function useCreateCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competenciesApi.createCompetency,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETENCY_KEYS.comps });
      toast.success("Competency created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create competency"),
  });
}

export function useUpdateCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateCompetency(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETENCY_KEYS.comps });
      toast.success("Competency updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update competency"),
  });
}

export function useDeleteCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competenciesApi.deleteCompetency,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETENCY_KEYS.comps });
      toast.success("Competency deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete competency"),
  });
}

/* ── Competency Indicators ──────────────────────────────────────────────── */

export function useIndicators(competencyId, enabled = true) {
  return useQuery({
    queryKey:  COMPETENCY_KEYS.indicators(competencyId),
    queryFn:   () => competenciesApi.getIndicators(competencyId),
    enabled:   !!competencyId && enabled,
    staleTime: STALE,
  });
}

export function useCreateIndicator(competencyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createIndicator(competencyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETENCY_KEYS.indicators(competencyId) });
      toast.success("Indicator added");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to add indicator"),
  });
}

export function useUpdateIndicator(competencyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateIndicator(competencyId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETENCY_KEYS.indicators(competencyId) });
      toast.success("Indicator updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update indicator"),
  });
}

export function useDeleteIndicator(competencyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deleteIndicator(competencyId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETENCY_KEYS.indicators(competencyId) });
      toast.success("Indicator deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete indicator"),
  });
}
