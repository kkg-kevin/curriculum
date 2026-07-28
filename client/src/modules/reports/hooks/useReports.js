import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { reportApi } from "../services/reportApi";

const KEYS = {
  readiness: (classId, courseId) => ["reports", "readiness", classId, courseId],
  list:      (classId, courseId) => ["reports", "list", classId, courseId],
  detail:    (id)                => ["reports", id],
  mine:      ()                  => ["reports", "mine"],
};

export function useReadiness(classId, courseId) {
  return useQuery({
    queryKey: KEYS.readiness(classId, courseId),
    queryFn:  () => reportApi.getReadiness(classId, courseId),
    enabled:  !!classId && !!courseId,
  });
}

export function useReportsList(classId, courseId) {
  return useQuery({
    queryKey: KEYS.list(classId, courseId),
    queryFn:  () => reportApi.listForClass(classId, courseId),
    enabled:  !!classId,
  });
}

export function useReport(id) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn:  () => reportApi.getById(id),
    enabled:  !!id,
  });
}

export function useMyReports() {
  return useQuery({
    queryKey: KEYS.mine(),
    queryFn:  () => reportApi.getMine(),
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
    mutationFn: ({ id, remarks }) => reportApi.updateRemarks(id, remarks),
    onSuccess: (report) => {
      qc.setQueryData(KEYS.detail(report.id), report);
      toast.success("Remarks saved");
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
