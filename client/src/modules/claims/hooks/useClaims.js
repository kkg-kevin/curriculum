import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claimsApi } from "../services/claimsApi";

// Money and review status change under the reader's feet (a supervisor approves while the
// educator is looking), so claims are never served stale from the cache.
const FRESH = { staleTime: 0 };

// `hubId`: only that hub's courses and totals (the portal's hub picker); without it, every hub.
export function useMyClaimCourses(hubId, { enabled = true } = {}) {
  return useQuery({ queryKey: ["claims", "my-courses", hubId || "all"], queryFn: () => claimsApi.getMyCourses(hubId ? { hubId } : undefined), enabled, ...FRESH });
}

export function useMyClaimCourse(classId, courseId) {
  return useQuery({
    queryKey: ["claims", "my-course", classId, courseId],
    queryFn: () => claimsApi.getMyCourse(classId, courseId),
    enabled: !!classId && !!courseId,
    ...FRESH,
  });
}

// The educator's own claims — each one an invoice (My Invoices).
export function useMyClaims() {
  return useQuery({ queryKey: ["claims", "mine"], queryFn: () => claimsApi.list(), ...FRESH });
}

// The same endpoint answers a supervisor with their own claims and educators; a separate cache
// key keeps the two shapes apart.
export function useSupervisorClaims() {
  return useQuery({ queryKey: ["claims", "supervisor"], queryFn: () => claimsApi.list(), ...FRESH, refetchInterval: 60 * 1000 });
}

export function useWorkspaceClaims() {
  return useQuery({ queryKey: ["claims", "workspace"], queryFn: () => claimsApi.list(), ...FRESH });
}

export function useClaim(id) {
  return useQuery({ queryKey: ["claims", "detail", id], queryFn: () => claimsApi.getById(id), enabled: !!id, ...FRESH });
}

// retry is off: someone who can't see supervisors (a 403) should just not get the picker.
export function useSupervisors({ enabled = true } = {}) {
  return useQuery({ queryKey: ["claims", "supervisors"], queryFn: claimsApi.listSupervisors, enabled, retry: false });
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
export const useCreateSupervisor = () => useClaimMutation(claimsApi.createSupervisor);
export const useUpdateSupervisor = () => useClaimMutation(({ id, ...data }) => claimsApi.updateSupervisor(id, data));
// Removing a supervisor also clears them from their educators.
export function useRemoveSupervisor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: claimsApi.removeSupervisor,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["claims"] }); queryClient.invalidateQueries({ queryKey: ["teachers"] }); },
  });
}

// M-Pesa payouts of one claim. While one waits for M-Pesa's answer it's asked about every few
// seconds; when it settles, the claim and every total are refreshed (it may now be paid).
export function useClaimPayouts(id, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["claims", "payouts", id],
    queryFn: () => claimsApi.mpesaPayouts(id),
    enabled: !!id && enabled,
    retry: false,
    refetchInterval: (q) => (q.state.data?.payouts?.[0]?.status === "pending" ? 4000 : false),
  });
  const latest = query.data?.payouts?.[0]?.status;
  const previous = useRef(latest);
  useEffect(() => {
    if (previous.current === "pending" && latest && latest !== "pending") queryClient.invalidateQueries({ queryKey: ["claims"] });
    previous.current = latest;
  }, [latest, queryClient]);
  return query;
}

export const usePayClaimByMpesa = () => useClaimMutation(({ id, ...data }) => claimsApi.payByMpesa(id, data));
