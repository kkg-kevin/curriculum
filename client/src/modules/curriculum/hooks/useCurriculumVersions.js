import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { curriculumVersionApi } from "../services/curriculumVersionApi";

export const VERSION_KEYS = {
  all:    (curriculumId) => ["curriculum-versions", curriculumId],
  detail: (curriculumId, versionId) => ["curriculum-versions", curriculumId, versionId],
};

export function useCurriculumVersionsQuery(curriculumId) {
  return useQuery({
    queryKey: VERSION_KEYS.all(curriculumId),
    queryFn:  () => curriculumVersionApi.getAll(curriculumId),
    enabled:  !!curriculumId,
  });
}

export function useCurriculumVersionQuery(curriculumId, versionId) {
  return useQuery({
    queryKey: VERSION_KEYS.detail(curriculumId, versionId),
    queryFn:  () => curriculumVersionApi.getById(curriculumId, versionId),
    enabled:  !!curriculumId && !!versionId,
  });
}

export function useCreateVersion(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => curriculumVersionApi.create(curriculumId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VERSION_KEYS.all(curriculumId) });
      toast.success("Draft version saved");
    },
    onError: (err) => toast.error(err.message || "Failed to save version"),
  });
}

export function usePublishVersion(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId) => curriculumVersionApi.publish(curriculumId, versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VERSION_KEYS.all(curriculumId) });
      toast.success("Version published and is now active");
    },
    onError: (err) => toast.error(err.message || "Failed to publish version"),
  });
}

export function useRevertVersion(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId) => curriculumVersionApi.revert(curriculumId, versionId),
    onSuccess: () => {
      // Invalidate the curriculum working copy AND the version list
      qc.invalidateQueries({ queryKey: ["curricula"] });
      qc.invalidateQueries({ queryKey: VERSION_KEYS.all(curriculumId) });
      toast.success("Curriculum restored to this version");
    },
    onError: (err) => toast.error(err.message || "Failed to revert version"),
  });
}
