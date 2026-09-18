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

// Logs the SAME visit (space/date/hours) for several learners at once — the server has no bulk
// endpoint (each learner can carry their own rate override, resolved per-call), so this fires one
// logVisit per learner and settles them all rather than failing the whole batch on one bad entry
// (e.g. a duplicate for just one of several selected learners, per the server's
// (learnerId, spaceId, visitDate) uniqueness rule). Returns { succeeded[], failed[] } so the
// caller can show exactly which learners still need attention instead of one opaque error.
//
// Each succeeded visit now comes back already invoiced (billingStatus: "invoiced") whenever the
// learner has a resolvable guardian payer — logVisit bills it immediately server-side rather than
// waiting for a separate "generate charges" step. A visit can still come back "unbilled" (no
// guardian email on file, or the space is free) — invalidating ["billing"] alongside the usual
// hub-visits keys keeps both surfaces in sync either way.
export function useLogVisits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ learnerIds, ...rest }) => {
      const results = await Promise.allSettled(learnerIds.map((learnerId) => hubVisitApi.logVisit({ ...rest, learnerId })));
      const succeeded = [];
      const failed = [];
      results.forEach((result, i) => {
        if (result.status === "fulfilled") succeeded.push(result.value);
        else failed.push({ learnerId: learnerIds[i], message: result.reason?.response?.data?.message || result.reason?.message || "Could not log visit" });
      });
      return { succeeded, failed };
    },
    onSuccess: ({ succeeded, failed }, { hubId }) => {
      if (succeeded.length > 0) {
        qc.invalidateQueries({ queryKey: HUB_VISIT_KEYS.all });
        qc.invalidateQueries({ queryKey: HUB_VISIT_KEYS.revenue(hubId) });
        qc.invalidateQueries({ queryKey: ["billing"] });
      }
      if (succeeded.length > 0 && failed.length === 0) {
        toast.success(`Logged ${succeeded.length} visit${succeeded.length === 1 ? "" : "s"}`);
      } else if (succeeded.length > 0 && failed.length > 0) {
        toast.error(`Logged ${succeeded.length}, ${failed.length} failed — see below`);
      } else {
        toast.error("Could not log any visits");
      }
    },
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
