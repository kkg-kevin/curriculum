import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { learningAreasApi } from "../services/learningAreasApi";

const STALE = 5 * 60 * 1000;

export const LEARNING_AREA_KEYS = {
  areas: ["settings", "learning-areas"],
};

// Unlike competencies, learning areas are copied (not linked) into a curriculum on
// import — see the curriculum service's importLearningArea. So editing the catalog
// here only needs to refresh the catalog list itself (e.g. the "Import from catalog"
// picker); curricula that already imported a copy are intentionally left untouched.

export function useLearningAreas() {
  return useQuery({
    queryKey:  LEARNING_AREA_KEYS.areas,
    queryFn:   learningAreasApi.getLearningAreas,
    staleTime: STALE,
  });
}

export function useCreateLearningArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: learningAreasApi.createLearningArea,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEARNING_AREA_KEYS.areas });
      toast.success("Learning area created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create learning area"),
  });
}

export function useUpdateLearningArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => learningAreasApi.updateLearningArea(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEARNING_AREA_KEYS.areas });
      toast.success("Learning area updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update learning area"),
  });
}

export function useDeleteLearningArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: learningAreasApi.deleteLearningArea,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEARNING_AREA_KEYS.areas });
      toast.success("Learning area deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete learning area"),
  });
}
