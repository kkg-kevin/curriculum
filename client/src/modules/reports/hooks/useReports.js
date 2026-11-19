import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { certificateApi } from "../../certificates/services/certificateApi";
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

// "File as not handed in" (19 Nov 2026): the learner's missing sessions are filed, so the course or
// module can be reported on — and its certificate issued — once published.
export function useFileNotSubmitted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportApi.fileNotSubmitted,
    onSuccess: ({ filed, needsGrading }) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      const what = `${filed} session${filed === 1 ? "" : "s"} filed as not handed in`;
      if (needsGrading) toast(`${what} — ${needsGrading} still ${needsGrading === 1 ? "has" : "have"} work to mark first`);
      else toast.success(`${what} — the report can be generated now`);
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Couldn't file the missing work"),
  });
}

// Whole class at once (19 Nov 2026): draft every ready learner's report, or publish every draft.
export function useBulkReports() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportApi.bulk,
    onSuccess: ({ done }, { action }) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["certificates"] });
      toast.success(action === "publish"
        ? `${done} report${done === 1 ? "" : "s"} published — now issue the certificates`
        : action === "issue"
          ? `${done} certificate${done === 1 ? "" : "s"} issued — families told`
          : `${done} draft${done === 1 ? "" : "s"} generated — review, then publish`);
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Couldn't finish that"),
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

// Issue certificate (19 Nov 2026): one learner's module or course certificate, once their report is
// published — certificates are no longer issued on publish. Takes the report's id.
export function useIssueCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportApi.issueCertificate,
    onSuccess: (certificate) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["certificates"] });
      toast.success(`Certificate ${certificate?.certificateNumber || ""} issued`.replace("  ", " "));
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Couldn't issue the certificate"),
  });
}

// Revoke from the Reports page (educators too since 19 Nov 2026) — refreshes the rows as well.
export function useRevokeReportCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => certificateApi.revoke(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["certificates"] });
      toast.success("Certificate revoked");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Couldn't revoke this certificate"),
  });
}

// Generate certificates at a module's (course's) last session (19 Nov 2026) — one learner
// (learnerIds) or the whole class. No report needed.
export function useGenerateCertificates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: certificateApi.generate,
    onSuccess: ({ done }) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["certificates"] });
      toast.success(done ? `${done} certificate${done === 1 ? "" : "s"} generated — families told` : "Everyone already has this certificate");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Couldn't generate the certificates"),
  });
}
