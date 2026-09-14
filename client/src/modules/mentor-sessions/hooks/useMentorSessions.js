import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mentorSessionApi } from "../services/mentorSessionApi";

export const MENTOR_SESSION_KEYS = {
  all:    ["mentorSessions"],
  byHub:  (hubId) => ["mentorSessions", "byHub", hubId],
  revenue: (hubId) => ["mentorSessions", "revenue", hubId],
};

export function useMentorSessionsQuery(hubId) {
  return useQuery({
    queryKey: MENTOR_SESSION_KEYS.byHub(hubId),
    queryFn: () => mentorSessionApi.getAll({ hubId }),
    enabled: !!hubId,
  });
}

export function useHubRevenueQuery(hubId) {
  return useQuery({
    queryKey: MENTOR_SESSION_KEYS.revenue(hubId),
    queryFn: () => mentorSessionApi.getHubRevenue(hubId),
    enabled: !!hubId,
  });
}

function invalidateForHub(qc, hubId) {
  qc.invalidateQueries({ queryKey: MENTOR_SESSION_KEYS.byHub(hubId) });
  qc.invalidateQueries({ queryKey: MENTOR_SESSION_KEYS.revenue(hubId) });
}

export function useCreateMentorSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorSessionApi.create,
    onSuccess: (session) => {
      invalidateForHub(qc, session.hubId);
      toast.success("Session logged");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to log session"),
  });
}

export function useUpdateMentorSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => mentorSessionApi.update(id, data),
    onSuccess: (session) => {
      invalidateForHub(qc, session.hubId);
      toast.success("Session updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update session"),
  });
}

export function useDeleteMentorSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => mentorSessionApi.remove(id),
    onSuccess: (_result, { hubId }) => {
      invalidateForHub(qc, hubId);
      toast.success("Session deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete session"),
  });
}
