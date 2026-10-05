import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claimsApi } from "../services/claimsApi";

// Money and review status change under the reader's feet (a supervisor approves while the
// educator is looking), so claims are never served stale from the cache.
const FRESH = { staleTime: 0 };

export function useMyClaimCourses() {
  return useQuery({ queryKey: ["claims", "my-courses"], queryFn: claimsApi.getMyCourses, ...FRESH });
}

export function useMyClaimCourse(classId, courseId) {
  return useQuery({
    queryKey: ["claims", "my-course", classId, courseId],
    queryFn: () => claimsApi.getMyCourse(classId, courseId),
    enabled: !!classId && !!courseId,
    ...FRESH,
  });
}

export function useWorkspaceClaims() {
  return useQuery({ queryKey: ["claims", "workspace"], queryFn: () => claimsApi.list(), ...FRESH });
}

export function useClaim(id) {
  return useQuery({ queryKey: ["claims", "detail", id], queryFn: () => claimsApi.getById(id), enabled: !!id, ...FRESH });
}

export function useClaimSettings({ enabled = true } = {}) {
  return useQuery({ queryKey: ["claims", "settings"], queryFn: claimsApi.getSettings, enabled });
}

// Every change to a claim moves totals on more than one screen — refresh them all.
function useClaimMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["claims"] }) });
}

export const useSubmitClaim = () => useClaimMutation(claimsApi.submit);
export const useWithdrawClaim = () => useClaimMutation(claimsApi.withdraw);
export const useSupervisorDecision = () => useClaimMutation(({ id, ...data }) => claimsApi.supervisorDecision(id, data));
export const useAdminDecision = () => useClaimMutation(({ id, ...data }) => claimsApi.adminDecision(id, data));
export const useMarkClaimPaid = () => useClaimMutation(({ id, ...data }) => claimsApi.markPaid(id, data));
export const useUpdateClaimSettings = () => useClaimMutation(claimsApi.updateSettings);
