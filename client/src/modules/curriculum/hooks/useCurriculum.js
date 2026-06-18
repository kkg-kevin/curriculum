import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { curriculumApi } from "../services/curriculumApi";

export const CURRICULUM_KEYS = {
  all: ["curricula"],
  list: (filters) => ["curricula", "list", filters],
  detail: (id) => ["curricula", "detail", id],
};

export function useCurriculaQuery() {
  const filters = useSelector((state) => state.curriculum.filters);
  return useQuery({
    queryKey: CURRICULUM_KEYS.list(filters),
    queryFn: () => curriculumApi.getAll(filters),
  });
}

export function useCurriculumQuery(id) {
  return useQuery({
    queryKey: CURRICULUM_KEYS.detail(id),
    queryFn: () => curriculumApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateCurriculum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: curriculumApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRICULUM_KEYS.all });
      toast.success("Curriculum created successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create curriculum");
    },
  });
}

export function useDeleteCurriculum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: curriculumApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRICULUM_KEYS.all });
      toast.success("Curriculum deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete curriculum");
    },
  });
}
