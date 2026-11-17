import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { reportApi } from "../services/reportApi";

const KEYS = {
  list:      (classId, courseId) => ["reports", "list", classId, courseId],
  detail:    (id)                => ["reports", id],
  mine:      (hubId)             => ["reports", "mine", hubId || null],
  learner:   (learnerId, hubId)  => ["reports", "learner", learnerId, hubId || null],
  hubAnalytics: (hubId, days, gender) => ["reports", "hubAnalytics", hubId, days, gender || null],
  platformAnalytics: (days)      => ["reports", "platformAnalytics", days],
};

export function useReport(id) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn:  () => reportApi.getById(id),
    enabled:  !!id,
  });
}

export function useHubAnalytics(hubId, days = 30, gender = null) {
  return useQuery({
    queryKey: KEYS.hubAnalytics(hubId, days, gender),
    queryFn:  () => reportApi.getHubAnalytics(hubId, days, gender),
    enabled:  !!hubId,
  });
}

export function usePlatformAnalytics(days = 30) {
  return useQuery({
    queryKey: KEYS.platformAnalytics(days),
    queryFn:  () => reportApi.getPlatformAnalytics(days),
  });
}

// The signed-in learner's own reports — or, given a learnerId, that learner's read by an
// admin/school viewing their profile.
export function useMyReports(hubId = null, learnerId = null) {
  return useQuery({
    queryKey: learnerId ? KEYS.learner(learnerId, hubId) : KEYS.mine(hubId),
    queryFn:  () => (learnerId ? reportApi.getForLearner(learnerId, hubId) : reportApi.getMine(hubId)),
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportApi.generate,
    onSuccess: (report) => {
      qc.setQueryData(KEYS.detail(report.id), report);
      qc.invalidateQueries({ queryKey: ["reports", "readiness"] });
      qc.invalidateQueries({ queryKey: ["reports", "list"] });
      toast.success("Report generated");
    },
    onError: (err) => toast.error(err.message || "Failed to generate report"),
  });
}

export function useUpdateRemarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => reportApi.updateRemarks(id, body),
    onSuccess: (report) => {
      qc.setQueryData(KEYS.detail(report.id), report);
      toast.success("Saved");
    },
    onError: (err) => toast.error(err.message || "Failed to save remarks"),
  });
}

export function usePublishReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportApi.publish,
    onSuccess: (report) => {
      qc.setQueryData(KEYS.detail(report.id), report);
      qc.invalidateQueries({ queryKey: ["reports", "readiness"] });
      qc.invalidateQueries({ queryKey: ["reports", "list"] });
      toast.success("Report published — the learner and guardian can now see it");
    },
    onError: (err) => toast.error(err.message || "Failed to publish report"),
  });
}

export function useUnpublishReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportApi.unpublish,
    onSuccess: (report) => {
      qc.setQueryData(KEYS.detail(report.id), report);
      qc.invalidateQueries({ queryKey: ["reports", "readiness"] });
      qc.invalidateQueries({ queryKey: ["reports", "list"] });
      toast.success("Report withdrawn — it's back to draft and hidden from the learner");
    },
    onError: (err) => toast.error(err.message || "Failed to withdraw report"),
  });
}
