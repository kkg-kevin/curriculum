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
