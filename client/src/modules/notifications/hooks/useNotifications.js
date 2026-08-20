import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { notificationApi } from "../services/notificationApi";

const KEY = ["notifications", "mine"];

// Polled rather than pushed — same tradeoff/pattern already proven by
// useAssessmentSubmission.js's useRosterForIssue (built for the identical "another browser
// session changed something, this one has to notice on its own" problem). staleTime:0 so a
// remount/refocus always refetches instead of serving a stale cache; refetchInterval keeps it
// current while the bell just sits open/closed on screen too. This hook is mounted globally
// (every role, via Header.jsx) rather than on a single teacher-facing page like the roster
// hook above, so its interval multiplies by every concurrent logged-in session — 60s instead
// of the original 20s cuts that aggregate load by two-thirds without meaningfully hurting a
// notification bell's freshness.
export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY,
    queryFn: notificationApi.list,
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
