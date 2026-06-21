import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { supplementaryApi } from "../services/supplementaryApi";

const KEYS = {
  all:      ["supplementary"],
  list:     () => ["supplementary", "list"],
  detail:   (id) => ["supplementary", "detail", id],
  bySchool: (schoolId) => ["supplementary", "bySchool", schoolId],
};

export function useSupplementaryListQuery() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn:  () => supplementaryApi.getAll(),
  });
}

export function useSupplementaryQuery(id) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn:  () => supplementaryApi.getById(id),
    enabled:  !!id,
  });
}

export function useSupplementaryBySchoolQuery(schoolId) {
  return useQuery({
    queryKey: KEYS.bySchool(schoolId),
    queryFn:  () => supplementaryApi.getBySchool(schoolId),
    enabled:  !!schoolId,
  });
}

export function useCreateSupplementary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => supplementaryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      toast.success("Supplementary curriculum created!");
    },
    onError: (err) => toast.error(err.message || "Failed to create"),
  });
}

export function useUpdateSupplementary(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => supplementaryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      queryClient.invalidateQueries({ queryKey: KEYS.detail(id) });
      toast.success("Saved!");
    },
    onError: (err) => toast.error(err.message || "Failed to save"),
  });
}

export function useDeleteSupplementary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => supplementaryApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      toast.success("Deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete"),
  });
}

export function useUpdateSupplementaryGrades(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grades) => supplementaryApi.updateGrades(id, grades),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      toast.success("Courses saved!");
    },
    onError: (err) => toast.error(err.message || "Failed to save courses"),
  });
}

export function useUpdateSupplementaryMapping(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mapping) => supplementaryApi.updateMapping(id, mapping),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      toast.success("Mapping saved!");
    },
    onError: (err) => toast.error(err.message || "Failed to save mapping"),
  });
}

export function useUpdateSupplementaryAssignments(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignments) => supplementaryApi.updateAssignments(id, assignments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      toast.success("Schools assigned!");
    },
    onError: (err) => toast.error(err.message || "Failed to save assignments"),
  });
}
