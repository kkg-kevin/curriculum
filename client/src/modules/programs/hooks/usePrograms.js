import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { programApi } from "../services/programApi";

export const PROGRAM_KEYS = {
  all:          ["programs"],
  detail:       (id) => ["programs", "detail", id],
  byCurriculum: (curriculumId) => ["programs", "byCurriculum", curriculumId],
};

export function useAllProgramsQuery() {
  return useQuery({
    queryKey: PROGRAM_KEYS.all,
    queryFn:  () => programApi.getAll(),
  });
}

// Every deployment (hub + dates) of one program curriculum — a curriculum can be deployed to
// more than one hub, or redeployed for a different run, so this is a list, not a single record.
export function useProgramsByCurriculumQuery(curriculumId) {
  return useQuery({
    queryKey: PROGRAM_KEYS.byCurriculum(curriculumId),
    queryFn:  () => programApi.getAll({ curriculumId }),
    enabled:  !!curriculumId,
  });
}

export function useProgramQuery(id) {
  return useQuery({
    queryKey: PROGRAM_KEYS.detail(id),
    queryFn:  () => programApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: programApi.create,
    // Invalidating the "programs" prefix also covers byCurriculum(id) queries below it.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAM_KEYS.all });
      toast.success("Program created successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create program"),
  });
}

export function useUpdateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => programApi.update(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: PROGRAM_KEYS.all });
      if (data?.id) qc.invalidateQueries({ queryKey: PROGRAM_KEYS.detail(data.id) });
      toast.success("Program updated successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update program"),
  });
}

export function useDeleteProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: programApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAM_KEYS.all });
      toast.success("Program deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete program"),
  });
}
