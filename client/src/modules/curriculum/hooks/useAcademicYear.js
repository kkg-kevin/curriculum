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

export function useCreateAcademicYear(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => academicYearApi.create(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      toast.success("Academic year created!");
    },
    onError: (err) => toast.error(err.message || "Failed to create academic year"),
  });
}

export function useEditAcademicYear(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ yearId, data }) => academicYearApi.edit(curriculumId, yearId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      toast.success("New version saved!");
    },
    onError: (err) => toast.error(err.message || "Failed to save version"),
  });
}

export function useChangeAcademicYearStatus(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ yearId, status }) => academicYearApi.changeStatus(curriculumId, yearId, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      toast.success(`Status set to ${label}`);
    },
    onError: (err) => toast.error(err.message || "Failed to update status"),
  });
}
