import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { curriculumVersionApi } from "../services/curriculumVersionApi";

const KEYS = { all: (cid) => ["curriculum-versions", cid] };

export function useCurriculumVersions(curriculumId) {
  return useQuery({
    queryKey: KEYS.all(curriculumId),
    queryFn:  () => curriculumVersionApi.getAll(curriculumId),
    enabled:  !!curriculumId,
    staleTime: 0,
  });
}

export function useCreateCurriculumVersion(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => curriculumVersionApi.create(curriculumId, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      toast.success(`Version ${data.versionNumber} created!`);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create version"),
  });
}

export function useChangeCurriculumVersionStatus(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vId, status }) => curriculumVersionApi.changeStatus(curriculumId, vId, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      toast.success(`Status set to ${label}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update status"),
  });
}
