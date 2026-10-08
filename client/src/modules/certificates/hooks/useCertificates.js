import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { certificateApi } from "../services/certificateApi";

const KEYS = {
  all:      ["certificates"],
  mine:     (hubId)             => ["certificates", "mine", hubId || null],
  learner:  (learnerId)         => ["certificates", "learner", learnerId],
  class:    (classId, courseId) => ["certificates", "class", classId, courseId || null],
  list:     (filters)           => ["certificates", "list", filters],
  detail:   (id)                => ["certificates", id],
  verify:   (token)             => ["certificates", "verify", token],
  settings: ["certificate-settings"],
};

export function useMyCertificates(hubId) {
  return useQuery({ queryKey: KEYS.mine(hubId), queryFn: () => certificateApi.getMine(hubId) });
}

// What this learner can earn next, and how far along they are.
export function useMyCertificateProgress(hubId) {
  return useQuery({ queryKey: ["certificates", "progress", hubId || null], queryFn: () => certificateApi.getMyProgress(hubId) });
}

// Staff: every certificate this learner holds that the caller can reach.
export function useLearnerCertificates(learnerId) {
  return useQuery({
    queryKey: KEYS.learner(learnerId),
    queryFn:  () => certificateApi.listForLearner(learnerId),
    enabled:  !!learnerId,
  });
}

export function useClassCertificates(classId, courseId) {
  return useQuery({
    queryKey: KEYS.class(classId, courseId),
    queryFn:  () => certificateApi.listForClass(classId, courseId),
    enabled:  !!classId,
  });
}

// Admin / school: the whole workspace's or hub's certificates, narrowed by `filters`.
export function useAllCertificates(filters) {
  return useQuery({ queryKey: KEYS.list(filters), queryFn: () => certificateApi.listAll(filters) });
}

export function useCertificate(id) {
  return useQuery({ queryKey: KEYS.detail(id), queryFn: () => certificateApi.getById(id), enabled: !!id });
}

export function useVerifyCertificate(token) {
  return useQuery({
    queryKey: KEYS.verify(token),
    queryFn:  () => certificateApi.verify(token),
    enabled:  !!token,
    retry:    (count, err) => (err?.statusCode ?? err?.response?.status) !== 404 && count < 2,
  });
}

// Revoking or reinstating one can change others (a pathway certificate rests on its courses'), so
// every certificate list is refreshed rather than just the row acted on.
export function useRevokeCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => certificateApi.revoke(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      toast.success("Certificate revoked");
    },
    onError: (err) => toast.error(err.message || "Couldn't revoke this certificate"),
  });
}

export function useReinstateCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => certificateApi.reinstate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      toast.success("Certificate reinstated");
    },
    onError: (err) => toast.error(err.message || "Couldn't reinstate this certificate"),
  });
}

export function useCertificateSettings() {
  return useQuery({ queryKey: KEYS.settings, queryFn: certificateApi.getSettings });
}

export function useSaveCertificateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => certificateApi.saveSettings(values),
    onSuccess: (data) => {
      queryClient.setQueryData(KEYS.settings, data);
      // Certificates issued before a signatory was set show the current one.
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      toast.success("Certificate settings saved");
    },
    onError: (err) => toast.error(err.message || "Couldn't save certificate settings"),
  });
}
