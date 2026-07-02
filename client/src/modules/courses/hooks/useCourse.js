import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { courseApi } from "../services/courseApi";

export const COURSE_KEYS = {
  all: ["courses"],
  detail: (id) => ["courses", "detail", id],
};

export function useCoursesQuery() {
  return useQuery({
    queryKey: COURSE_KEYS.all,
    queryFn: () => courseApi.getAll(),
  });
}

export function useCourseQuery(id) {
  return useQuery({
    queryKey: COURSE_KEYS.detail(id),
    queryFn: () => courseApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: courseApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COURSE_KEYS.all });
      toast.success("Course created successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create course");
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => courseApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: COURSE_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: COURSE_KEYS.detail(data.id) });
      toast.success("Course updated successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update course");
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: courseApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COURSE_KEYS.all });
      toast.success("Course deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete course");
    },
  });
}
