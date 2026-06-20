import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { teacherApi } from "../services/teacherApi";

export const TEACHER_KEYS = {
  all:    ["teachers"],
  list:   (filters) => ["teachers", "list", filters],
  detail: (id)      => ["teachers", "detail", id],
};

export function useTeachersQuery() {
  const filters = useSelector((state) => state.teachers.filters);
  return useQuery({
    queryKey: TEACHER_KEYS.list(filters),
    queryFn:  () => teacherApi.getAll(filters),
  });
}

export function useTeacherQuery(id) {
  return useQuery({
    queryKey: TEACHER_KEYS.detail(id),
    queryFn:  () => teacherApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teacherApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_KEYS.all });
      toast.success("Teacher added successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to add teacher"),
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => teacherApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: TEACHER_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: TEACHER_KEYS.detail(data.id) });
      toast.success("Teacher updated successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to update teacher"),
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teacherApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_KEYS.all });
      toast.success("Teacher removed");
    },
    onError: (err) => toast.error(err.message || "Failed to remove teacher"),
  });
}
