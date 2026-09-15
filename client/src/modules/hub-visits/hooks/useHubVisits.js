import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { hubVisitApi } from "../services/hubVisitApi";

export const HUB_VISIT_KEYS = { all: ["hub-visits"], hub: (hubId) => ["hub-visits", "hub", hubId], revenue: (hubId) => ["hub-visits", "revenue", hubId] };

export function useHubVisitsQuery(filters = {}) {
  return useQuery({
    queryKey: [...HUB_VISIT_KEYS.all, filters],
    queryFn: () => hubVisitApi.list(filters),
    enabled: !!filters.hubId,
  });
}

export function useLogVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hubVisitApi.logVisit,
    onSuccess: (visit) => {
      qc.invalidateQueries({ queryKey: HUB_VISIT_KEYS.all });
      qc.invalidateQueries({ queryKey: HUB_VISIT_KEYS.revenue(visit.hubId) });
      toast.success("Visit logged");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Could not log visit"),
  });
}

export function useUpdateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => hubVisitApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: HUB_VISIT_KEYS.all }); toast.success("Visit updated"); },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Could not update visit"),
  });
}

export function useDeleteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hubVisitApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: HUB_VISIT_KEYS.all }); toast.success("Visit deleted"); },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Could not delete visit"),
  });
}

export function usePreviewGenerateCharges() {
  return useMutation({
    mutationFn: ({ hubId, data }) => hubVisitApi.previewGenerateCharges(hubId, data),
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Could not preview charges"),
  });
}

export function useGenerateCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ hubId, data }) => hubVisitApi.generateCharges(hubId, data),
    onSuccess: (_result, { hubId }) => {
      qc.invalidateQueries({ queryKey: HUB_VISIT_KEYS.all });
      qc.invalidateQueries({ queryKey: HUB_VISIT_KEYS.revenue(hubId) });
      qc.invalidateQueries({ queryKey: ["billing"] });
      toast.success("Charges generated and issued");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Could not generate charges"),
  });
}

export function useHubRevenueSummaryQuery(hubId) {
  return useQuery({
    queryKey: HUB_VISIT_KEYS.revenue(hubId),
    queryFn: () => hubVisitApi.getHubRevenueSummary(hubId),
    enabled: !!hubId,
  });
}

export function useAllHubsRevenueSummaryQuery({ enabled = true } = {}) {
  return useQuery({ queryKey: ["hub-visits", "revenue-all"], queryFn: hubVisitApi.getAllHubsRevenueSummary, enabled });
}
