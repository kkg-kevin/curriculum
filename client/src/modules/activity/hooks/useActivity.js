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

export function useActivityFacets({ enabled = true } = {}) {
  return useQuery({ queryKey: ["activity", "facets"], queryFn: activityApi.facets, staleTime: 60 * 1000, enabled });
}
