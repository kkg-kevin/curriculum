import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { courseApi } from "../services/courseApi";

export const COURSE_KEYS = {
  all: ["courses"],
  detail: (id) => ["courses", "detail", id],
  sessions: (courseId) => ["courses", "sessions", courseId],
  competencies: (courseId) => ["courses", "competencies", courseId],
  learningAreas: (courseId) => ["courses", "learning-areas", courseId],
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

/* ── Competencies (authored globally in Settings, tagged onto a course here) ── */

export function useCourseCompetencies(courseId) {
  return useQuery({
    queryKey: COURSE_KEYS.competencies(courseId),
    queryFn: () => courseApi.getCourseCompetencies(courseId),
    enabled: !!courseId,
  });
}

/* ── Learning Areas (authored globally in Settings, tagged onto a course here) ── */

export function useCourseLearningAreas(courseId) {
  return useQuery({
    queryKey: COURSE_KEYS.learningAreas(courseId),
    queryFn: () => courseApi.getCourseLearningAreas(courseId),
    enabled: !!courseId,
  });
}

/* ── Sessions ─────────────────────────────────────────────────────────── */

export function useSessions(courseId) {
  return useQuery({
    queryKey: COURSE_KEYS.sessions(courseId),
    queryFn: () => courseApi.getSessions(courseId),
    enabled: !!courseId,
  });
}

export function useCreateSession(courseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => courseApi.createSession(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COURSE_KEYS.sessions(courseId) });
      toast.success("Session added");
    },
    onError: (err) => toast.error(err.message || "Failed to add session"),
  });
}

export function useCreateSessionsBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, count }) => courseApi.createSessionsBulk(courseId, count),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: COURSE_KEYS.sessions(courseId) });
    },
    onError: (err) => toast.error(err.message || "Failed to create sessions"),
  });
}

export function useUpdateSession(courseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => courseApi.updateSession(courseId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COURSE_KEYS.sessions(courseId) });
      toast.success("Session updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update session"),
  });
}

export function useDeleteSession(courseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => courseApi.deleteSession(courseId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COURSE_KEYS.sessions(courseId) });
      toast.success("Session deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete session"),
  });
}
