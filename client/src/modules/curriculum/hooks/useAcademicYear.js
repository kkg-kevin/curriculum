import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { academicYearApi } from "../services/academicYearApi";

const KEYS = { all: (cid) => ["academic-years", cid] };

export function useAcademicYears(curriculumId) {
  return useQuery({
    queryKey: KEYS.all(curriculumId),
    queryFn:  () => academicYearApi.getAll(curriculumId),
    enabled:  !!curriculumId,
  });
}

export function useCreateAcademicYearGroup(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => academicYearApi.createGroup(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      toast.success("Academic year created!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create academic year"),
  });
}

export function useCreateAcademicYearVersion(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, data }) => academicYearApi.createVersion(curriculumId, groupId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      toast.success("New draft version created!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create version"),
  });
}

export function useChangeAcademicYearStatus(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, versionId, status }) =>
      academicYearApi.changeStatus(curriculumId, groupId, versionId, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      toast.success(`Status set to ${label}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update status"),
  });
}
