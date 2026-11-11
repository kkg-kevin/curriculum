import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { analyticsApi } from "../services/analyticsApi";

export function useAnalyticsFilters(hubId) {
  return useQuery({ queryKey: ["analytics", "filters", hubId || ""], queryFn: () => analyticsApi.filters(hubId), staleTime: 5 * 60 * 1000 });
}

// One tab's figures for the chosen period and filters. The last result stays on screen while a
// new filter loads, so the page doesn't jump.
export function useAnalytics(view, params, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["analytics", view, params],
    queryFn: () => analyticsApi.view(view, params),
    enabled,
    staleTime: 60 * 1000,
    // Only the same tab's previous figures — another tab's have a different shape.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey?.[1] === view ? keepPreviousData(previous) : undefined),
  });
}

// Following up a learner at risk — the at-risk list and "Needs your attention" recount after.
export function useRecordFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: analyticsApi.followup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analytics", "at-risk"] });
      qc.invalidateQueries({ queryKey: ["analytics", "attention"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || err?.message || "That couldn't be saved"),
  });
}

export function useFollowupHistory(learnerId) {
  return useQuery({ queryKey: ["analytics", "followups", learnerId], queryFn: () => analyticsApi.followupHistory(learnerId), enabled: !!learnerId });
}
