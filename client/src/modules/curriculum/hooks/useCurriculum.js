import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { curriculumApi } from "../services/curriculumApi";
import { PROGRAM_KEYS } from "../../programs/hooks/usePrograms";

export const CURRICULUM_KEYS = {
  all: ["curricula"],
  list: (filters) => ["curricula", "list", filters],
  detail: (id) => ["curricula", "detail", id],
  courses: (id) => ["curricula", "courses", id],
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

// For a "curriculumAdmin" account — their own assigned curriculum. Not enabled by default;
// callers gate this on the logged-in user's role.
export function useMyCurriculumQuery(enabled) {
  return useQuery({
    queryKey: ["curricula", "mine"],
    queryFn: () => curriculumApi.getMine(),
    enabled: !!enabled,
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

export function useUpdateCurriculum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => curriculumApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CURRICULUM_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: CURRICULUM_KEYS.detail(data.id) });
      // A Program is this same curriculum record under an isProgram flag — ProgramViewPage
      // reads the curriculum's name/description through its own cached program query, which
      // this edit doesn't otherwise touch. Without this, a Program view can keep showing
      // pre-edit curriculum fields until its own cache happens to go stale.
      queryClient.invalidateQueries({ queryKey: PROGRAM_KEYS.all });
      toast.success("Curriculum updated successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update curriculum");
    },
  });
}

/* ── Courses (added to this curriculum from here — a course stays independent otherwise) ── */

export function useCurriculumCourses(curriculumId) {
  return useQuery({
    queryKey: CURRICULUM_KEYS.courses(curriculumId),
    queryFn: () => curriculumApi.getCurriculumCourses(curriculumId),
    enabled: !!curriculumId,
  });
}

export function useLinkCourse(curriculumId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId) => curriculumApi.linkCourse(curriculumId, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRICULUM_KEYS.courses(curriculumId) });
      // Attaching a course can auto-populate this curriculum's competencies/pathways
      // (see CurriculumService.autoPopulateFromCourse) — refresh those too so the
      // Competencies page reflects it without a hard reload.
      queryClient.invalidateQueries({ queryKey: ["curriculum-competencies", curriculumId] });
      queryClient.invalidateQueries({ queryKey: ["pathways", curriculumId] });
      toast.success("Course added to this curriculum");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to add course"),
  });
}

export function useUnlinkCourse(curriculumId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId) => curriculumApi.unlinkCourse(curriculumId, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRICULUM_KEYS.courses(curriculumId) });
      toast.success("Course removed from this curriculum");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to remove course"),
  });
}

/* ── Curriculum admin — the one account delegated to manage this specific curriculum ───── */
/* curriculum.curriculumAdmin ({id,name,email} or null) comes back on the normal detail read
   (useCurriculumQuery) — these mutations just invalidate that same query on success. */

export function useAssignCurriculumAdmin(curriculumId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => curriculumApi.assignAdmin(curriculumId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRICULUM_KEYS.detail(curriculumId) });
      toast.success("Curriculum admin assigned");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to assign curriculum admin"),
  });
}

export function useUnassignCurriculumAdmin(curriculumId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => curriculumApi.unassignAdmin(curriculumId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRICULUM_KEYS.detail(curriculumId) });
      toast.success("Curriculum admin unassigned");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to unassign curriculum admin"),
  });
}
