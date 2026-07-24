import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { programApi } from "../services/programApi";

export const PROGRAM_KEYS = {
  all:    ["programs"],
  detail: (id) => ["programs", "detail", id],
};

export function useAllProgramsQuery() {
  return useQuery({
    queryKey: PROGRAM_KEYS.all,
    queryFn:  programApi.getAll,
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
