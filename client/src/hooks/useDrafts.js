import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../services/api";

// Reading and deleting the workspace's drafts of unsaved work (writing them is
// useWorkspaceDraft.js). `endpoint` is the module's drafts API — "/api/assessments/drafts" or
// "/api/courses/drafts".
export const DRAFT_ENDPOINTS = {
  assessments: "/api/assessments/drafts",
  courses: "/api/courses/drafts",
};

export const draftsApi = {
  list: (endpoint, params) => api.get(endpoint, { params }).then((r) => r.data.data),
  get: (endpoint, draftId) => api.get(`${endpoint}/${draftId}`).then((r) => r.data.data),
  remove: (endpoint, draftId) => api.delete(`${endpoint}/${draftId}`).then((r) => r.data),
};

// Never served from cache: other people in the workspace are writing these as they type.
export function useDraftsQuery(endpoint, params = {}, options = {}) {
  return useQuery({
    queryKey: ["drafts", endpoint, params],
    queryFn: () => draftsApi.list(endpoint, params),
    staleTime: 0,
    ...options,
  });
}

export function useDraftQuery(endpoint, draftId, options = {}) {
  return useQuery({
    queryKey: ["drafts", endpoint, "one", draftId],
    queryFn: () => draftsApi.get(endpoint, draftId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    ...options,
    enabled: Boolean(draftId) && (options.enabled ?? true),
  });
}

export function useDeleteDraft(endpoint) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftId) => draftsApi.remove(endpoint, draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      toast.success("Draft deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete draft");
    },
  });
}

// Drafts earlier visits left on a record — the ones the restore dialog offers, noted while the form
// still shows the record as it was opened. Saving the record supersedes them, so the returned
// drop(recordId) deletes them once the save has gone through; without it a draft passed over with
// "Not now" (or one of several) kept the record marked "Unsaved draft" after every save. A draft
// someone else starts while this form is open isn't noted, so it's kept.
//
// drafts — the record's drafts as listed; untouched — the form is still as it was loaded;
// ownDraftId — the draft this visit is writing (deleted by the save itself).
export function useDraftsSeenAtOpen(endpoint, { drafts, recordId, untouched, ownDraftId }) {
  const queryClient = useQueryClient();
  const seen = useRef(new Map());
  useEffect(() => {
    if (!untouched || !recordId) return;
    const ids = drafts.filter((d) => d.recordId === recordId && d.id !== ownDraftId).map((d) => d.id);
    if (!ids.length) return;
    const noted = seen.current.get(recordId) || new Set();
    ids.forEach((draftId) => noted.add(draftId));
    seen.current.set(recordId, noted);
  }, [untouched, recordId, drafts, ownDraftId]);

  return useCallback((forRecord) => {
    const ids = [...(seen.current.get(forRecord) || [])];
    seen.current.delete(forRecord);
    if (!ids.length) return;
    Promise.allSettled(ids.map((draftId) => draftsApi.remove(endpoint, draftId)))
      .then(() => queryClient.invalidateQueries({ queryKey: ["drafts"] }));
  }, [endpoint, queryClient]);
}
