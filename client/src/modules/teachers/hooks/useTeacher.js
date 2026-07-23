import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { teacherApi } from "../services/teacherApi";

export const TEACHER_KEYS = {
  all:    ["teachers"],
  detail: (id)      => ["teachers", "detail", id],
  hubs:   (id)      => ["teachers", "detail", id, "hubs"],
};

export function useAllTeachersQuery() {
  return useQuery({
    queryKey: ["teachers", "all"],
    queryFn:  () => teacherApi.getAll({}),
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
      toast.success("Tech Educator added successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to add tech educator"),
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => teacherApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: TEACHER_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: TEACHER_KEYS.detail(data.id) });
      toast.success("Tech Educator updated successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to update tech educator"),
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teacherApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_KEYS.all });
      toast.success("Tech Educator deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete tech educator"),
  });
}

export function useTeacherHubsQuery(teacherId) {
  return useQuery({
    queryKey: TEACHER_KEYS.hubs(teacherId),
    queryFn:  () => teacherApi.getHubs(teacherId),
    enabled:  !!teacherId,
  });
}

export function useLinkTeacherHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherId, hubId }) => teacherApi.linkHub(teacherId, hubId),
    onSuccess: (_data, { teacherId }) => {
      queryClient.invalidateQueries({ queryKey: TEACHER_KEYS.hubs(teacherId) });
      toast.success("Tech Educator assigned to hub");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to assign hub"),
  });
}

export function useUnlinkTeacherHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherId, hubId }) => teacherApi.unlinkHub(teacherId, hubId),
    onSuccess: (_data, { teacherId }) => {
      queryClient.invalidateQueries({ queryKey: TEACHER_KEYS.hubs(teacherId) });
      toast.success("Tech Educator removed from hub");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to remove from hub"),
  });
}
