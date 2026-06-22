import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { schoolApi } from "../services/schoolApi";

export const SCHOOL_KEYS = {
  all: ["schools"],
  list: (filters) => ["schools", "list", filters],
  detail: (id) => ["schools", "detail", id],
};

export function useSchoolsQuery() {
  const filters = useSelector((state) => state.schools.filters);
  return useQuery({
    queryKey: SCHOOL_KEYS.list(filters),
    queryFn: () => schoolApi.getAll(filters),
  });
}

export function useAllSchoolsQuery() {
  return useQuery({
    queryKey: ["schools", "all"],
    queryFn: () => schoolApi.getAll({}),
  });
}

export function useSchoolQuery(id) {
  return useQuery({
    queryKey: SCHOOL_KEYS.detail(id),
    queryFn: () => schoolApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: schoolApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHOOL_KEYS.all });
      toast.success("School created successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create school");
    },
  });
}

export function useUpdateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => schoolApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SCHOOL_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: SCHOOL_KEYS.detail(data.id) });
      toast.success("School updated successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update school");
    },
  });
}

export function useDeleteSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: schoolApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHOOL_KEYS.all });
      toast.success("School deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete school");
    },
  });
}
