import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { systemLevelsApi } from "../services/systemLevelsApi";

const STALE = 5 * 60 * 1000;

export const SYSTEM_LEVEL_KEYS = {
  levels: ["settings", "system-levels"],
};

// The 14-level spine is read by every curriculum's Structure page (to render the
// include/label/phase table), so it's cached a while — it changes rarely.
export function useSystemLevels() {
  return useQuery({
    queryKey:  SYSTEM_LEVEL_KEYS.levels,
    queryFn:   systemLevelsApi.getSystemLevels,
    staleTime: STALE,
  });
}

export function useCreateSystemLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: systemLevelsApi.createSystemLevel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SYSTEM_LEVEL_KEYS.levels });
      toast.success("Level added");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to add level"),
  });
}

export function useUpdateSystemLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => systemLevelsApi.updateSystemLevel(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SYSTEM_LEVEL_KEYS.levels });
      toast.success("Level updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update level"),
  });
}

export function useDeleteSystemLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: systemLevelsApi.deleteSystemLevel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SYSTEM_LEVEL_KEYS.levels });
      toast.success("Level deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete level"),
  });
}

export function useReorderSystemLevels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: systemLevelsApi.reorderSystemLevels,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SYSTEM_LEVEL_KEYS.levels });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to reorder levels"),
  });
}
