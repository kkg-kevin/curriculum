import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { learnerApi } from "../services/learnerApi";

export const LEARNER_KEYS = {
  all:    ["learners"],
  detail: (id)      => ["learners", "detail", id],
  hubs:   (id)      => ["learners", "detail", id, "hubs"],
};

export function useAllLearnersQuery() {
  return useQuery({
    queryKey: ["learners", "all"],
    queryFn:  () => learnerApi.getAll({}),
  });
}

export function useLearnerQuery(id) {
  return useQuery({
    queryKey: LEARNER_KEYS.detail(id),
    queryFn:  () => learnerApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateLearner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: learnerApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.all });
      toast.success("Learner enrolled successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to enroll learner"),
  });
}

export function useUpdateLearner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => learnerApi.update(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.all });
      if (data?.id) qc.invalidateQueries({ queryKey: LEARNER_KEYS.detail(data.id) });
      toast.success("Learner updated successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to update learner"),
  });
}

export function useUpdateLearnerAccountStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountStatus }) => learnerApi.updateAccountStatus(id, accountStatus),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.all });
      if (data?.id) qc.invalidateQueries({ queryKey: LEARNER_KEYS.detail(data.id) });
      toast.success(`Learner account ${data?.accountStatus === "inactive" ? "deactivated" : "activated"}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update learner account status"),
  });
}

export function useDeleteLearner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: learnerApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.all });
      toast.success("Learner removed");
    },
    onError: (err) => toast.error(err.message || "Failed to remove learner"),
  });
}

// Not invalidated on error — a partial batch (some rows created, some failed) still needs its
// created rows to show up, and the caller (BulkImportLearnersPanel) reads created/failed/results
// off the resolved value itself rather than a toast, so no onSuccess/onError toast here.
export function useBulkImportLearners() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: learnerApi.bulkImport,
    onSuccess: () => qc.invalidateQueries({ queryKey: LEARNER_KEYS.all }),
  });
}

export function useLearnerHubsQuery(learnerId) {
  return useQuery({
    queryKey: LEARNER_KEYS.hubs(learnerId),
    queryFn:  () => learnerApi.getHubs(learnerId),
    enabled:  !!learnerId,
  });
}

// One-shot search by name, username, or registration number, used to find a learner already
// enrolled at a DIFFERENT hub so they can be enrolled here too (see AddExistingLearnerPanel in
// SchoolLearnersPage.jsx) — a mutation rather than a query since it's fired on demand by a
// search button, not something that should refetch reactively. Server returns every match (up
// to a cap), each with a hubCount but never the other hub's identity (see
// learner.controller.js's getAllLearners).
export function useSearchLearners() {
  return useMutation({
    mutationFn: (q) => learnerApi.getAll({ q }).then((r) => r.data || []),
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Search failed"),
  });
}

export function useEnrollLearnerHub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ learnerId, data }) => learnerApi.enrollHub(learnerId, data),
    onSuccess: (_data, { learnerId }) => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.hubs(learnerId) });
      toast.success("Learner enrolled at hub");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to enroll at hub"),
  });
}

export function useUpdateLearnerHubLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ learnerId, hubId, data }) => learnerApi.updateHub(learnerId, hubId, data),
    onSuccess: (_data, { learnerId }) => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.hubs(learnerId) });
      toast.success("Enrollment updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update enrollment"),
  });
}

export function useUnenrollLearnerHub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ learnerId, hubId }) => learnerApi.unenrollHub(learnerId, hubId),
    onSuccess: (_data, { learnerId }) => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.hubs(learnerId) });
      toast.success("Learner removed from hub");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to remove from hub"),
  });
}

// Moves a learner from one hub to another in one action (enroll-at-new + unlink-old) — see
// transferHub's comment server-side for why this isn't just a status flip on the old link.
export function useTransferLearnerHub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ learnerId, hubId, data }) => learnerApi.transferHub(learnerId, hubId, data),
    onSuccess: (_data, { learnerId }) => {
      qc.invalidateQueries({ queryKey: LEARNER_KEYS.hubs(learnerId) });
      toast.success("Learner transferred");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to transfer learner"),
  });
}

// A mutation, not a query — fetched on demand when the "Share Profile" card is opened, rather
// than eagerly on every profile view (most views of this page are never going to want a QR).
// get-or-create server-side, so this is safe to fire every time the card opens without minting
// a fresh token (and so invalidating the last printed one) on every click.
export function usePublicToken() {
  return useMutation({
    mutationFn: learnerApi.getPublicToken,
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to load share link"),
  });
}

export function useRegeneratePublicToken() {
  return useMutation({
    mutationFn: learnerApi.regeneratePublicToken,
    onSuccess: () => toast.success("Share link regenerated — the old QR code no longer works"),
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to regenerate share link"),
  });
}

// The public scan destination's own data fetch — unauthenticated, keyed by token rather than an
// id, and never invalidated by anything else in the app's query cache.
export function usePublicLearnerProfile(token) {
  return useQuery({
    queryKey: ["learners", "public", token],
    queryFn:  () => learnerApi.getPublicProfile(token),
    enabled:  !!token,
    retry: false,
  });
}
