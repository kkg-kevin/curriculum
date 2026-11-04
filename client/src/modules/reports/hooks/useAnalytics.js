import { useQuery, keepPreviousData } from "@tanstack/react-query";
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
