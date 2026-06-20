import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { classApi } from "../services/classApi";

export const CLASS_KEYS = {
  all:    ["classes"],
  list:   (filters) => ["classes", "list", filters],
  detail: (id)      => ["classes", "detail", id],
};

export function useClassesQuery() {
  const filters = useSelector((state) => state.classes.filters);
  return useQuery({
    queryKey: CLASS_KEYS.list(filters),
    queryFn:  () => classApi.getAll(filters),
  });
}

export function useClassQuery(id) {
  return useQuery({
    queryKey: CLASS_KEYS.detail(id),
    queryFn:  () => classApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: classApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLASS_KEYS.all });
      toast.success("Class created successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to create class"),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => classApi.update(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: CLASS_KEYS.all });
      if (data?.id) qc.invalidateQueries({ queryKey: CLASS_KEYS.detail(data.id) });
      toast.success("Class updated successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to update class"),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: classApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLASS_KEYS.all });
      toast.success("Class deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete class"),
  });
}
