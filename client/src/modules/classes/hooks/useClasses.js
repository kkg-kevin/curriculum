import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { classApi } from "../services/classApi";

export const CLASS_KEYS = {
  all:    ["classes"],
  detail: (id)      => ["classes", "detail", id],
  courseTeachers: (classId)  => ["classes", "detail", classId, "course-teachers"],
  teacherLinks:   (teacherId) => ["classes", "course-teacher-links", teacherId],
};

export function useAllClassesQuery() {
  return useQuery({
    queryKey: ["classes", "all"],
    queryFn:  () => classApi.getAll({}),
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
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create class"),
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

export function useBulkCreateClasses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: classApi.bulkCreate,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: CLASS_KEYS.all });
      toast.success(`${data.length} class${data.length !== 1 ? "es" : ""} set up successfully!`);
    },
    onError: (err) => toast.error(err.message || "Failed to set up classes"),
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

// Course-educator assignment — per (class, course) pair, multiple co-equal educators allowed.
export function useClassCourseTeachers(classId) {
  return useQuery({
    queryKey: CLASS_KEYS.courseTeachers(classId),
    queryFn:  () => classApi.getCourseTeachers(classId),
    enabled:  !!classId,
  });
}

export function useAssignCourseTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, courseId, teacherId }) => classApi.assignCourseTeacher(classId, courseId, teacherId),
    onSuccess: (_data, { classId, teacherId }) => {
      qc.invalidateQueries({ queryKey: CLASS_KEYS.courseTeachers(classId) });
      qc.invalidateQueries({ queryKey: CLASS_KEYS.teacherLinks(teacherId) });
      toast.success("Educator assigned to course");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to assign educator"),
  });
}

export function useUnassignCourseTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, courseId, teacherId }) => classApi.unassignCourseTeacher(classId, courseId, teacherId),
    onSuccess: (_data, { classId, teacherId }) => {
      qc.invalidateQueries({ queryKey: CLASS_KEYS.courseTeachers(classId) });
      qc.invalidateQueries({ queryKey: CLASS_KEYS.teacherLinks(teacherId) });
      toast.success("Educator removed from course");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to remove educator"),
  });
}

export function useSetPrimaryCourseTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, courseId, teacherId }) => classApi.setPrimaryCourseTeacher(classId, courseId, teacherId),
    onSuccess: (_data, { classId, teacherId }) => {
      qc.invalidateQueries({ queryKey: CLASS_KEYS.courseTeachers(classId) });
      qc.invalidateQueries({ queryKey: CLASS_KEYS.teacherLinks(teacherId) });
      toast.success("Primary educator updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update primary educator"),
  });
}

// Every (class, course) link for one teacher, across every class — feeds TeacherViewPage's
// "my course assignments" list.
export function useTeacherCourseAssignments(teacherId) {
  return useQuery({
    queryKey: CLASS_KEYS.teacherLinks(teacherId),
    queryFn:  () => classApi.getCourseTeacherLinksForTeacher(teacherId),
    enabled:  !!teacherId,
  });
}
