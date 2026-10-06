import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { activityApi } from "../services/activityApi";

// The log changes with everything anyone does, so it is never served stale from the cache.
export function useActivity(filters, { enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: ["activity", "list", filters],
    queryFn: ({ pageParam }) => activityApi.list(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 0,
    enabled,
  });
}

// The numbers on the Activity page's tabs. The tab itself and its own sub-filter are left out by
// the caller, so switching tabs doesn't refetch.
export function useActivityCounts(filters) {
  return useQuery({ queryKey: ["activity", "counts", filters], queryFn: () => activityApi.counts(filters), staleTime: 0, placeholderData: (previous) => previous });
}

export function useActivityFacets({ enabled = true } = {}) {
  return useQuery({ queryKey: ["activity", "facets"], queryFn: activityApi.facets, staleTime: 60 * 1000, enabled });
}
