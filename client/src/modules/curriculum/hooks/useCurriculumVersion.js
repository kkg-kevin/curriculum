import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { curriculumVersionApi } from "../services/curriculumVersionApi";

const KEYS = {
  all:            (cid)            => ["curriculum-versions", cid],
  currentCourses: (cid, gradeName) => ["curriculum-versions", cid, "current-courses", gradeName || null],
};

export function useCurriculumVersions(curriculumId) {
  return useQuery({
    queryKey: KEYS.all(curriculumId),
    queryFn:  () => curriculumVersionApi.getAll(curriculumId),
    enabled:  !!curriculumId,
    staleTime: 0,
  });
}

// What learner/teacher portals should read — the live version's courses, not the separate
// flat course-curriculum link. Pass a gradeName to scope to one grade; omit for every grade.
export function useCurriculumCurrentCourses(curriculumId, gradeName) {
  return useQuery({
    queryKey: KEYS.currentCourses(curriculumId, gradeName),
    queryFn:  () => curriculumVersionApi.getCurrentCourses(curriculumId, gradeName),
    enabled:  !!curriculumId,
  });
}

// Same as above, but for a teacher assigned to more than one class — merges current courses
// across every distinct grade they're the class teacher for (shares cache entries with the
// single-grade hook above, since it's the same query key per grade).
export function useCurriculumCurrentCoursesForGrades(curriculumId, gradeNames) {
  const results = useQueries({
    queries: (gradeNames || []).map((gradeName) => ({
      queryKey: KEYS.currentCourses(curriculumId, gradeName),
      queryFn:  () => curriculumVersionApi.getCurrentCourses(curriculumId, gradeName),
      enabled:  !!curriculumId,
    })),
  });

  const byId = new Map();
  results.forEach((r) => (r.data || []).forEach((c) => byId.set(c.id, c)));

  return { data: [...byId.values()], isLoading: results.some((r) => r.isLoading) };
}

// Same per-grade queries as above, but kept separate per grade instead of merged — for a
// school-wide view that needs to know which specific grade has which courses (e.g. "Grade 1
// has 0 courses"), not just the deduplicated union.
export function useCurriculumCoursesByGrade(curriculumId, gradeNames) {
  const names = gradeNames || [];
  const results = useQueries({
    queries: names.map((gradeName) => ({
      queryKey: KEYS.currentCourses(curriculumId, gradeName),
      queryFn:  () => curriculumVersionApi.getCurrentCourses(curriculumId, gradeName),
      enabled:  !!curriculumId,
    })),
  });

  const byGrade = new Map();
  names.forEach((gradeName, i) => byGrade.set(gradeName, results[i]?.data || []));

  return { data: byGrade, isLoading: results.some((r) => r.isLoading) };
}

export function useCreateCurriculumVersion(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => curriculumVersionApi.create(curriculumId, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      // Creating a version can auto-populate this curriculum's competencies/learning areas
      // from every course in its content (see CurriculumVersionService.create) — refresh
      // those too so the Competencies page reflects it without a hard reload.
      qc.invalidateQueries({ queryKey: ["curriculum-competencies", curriculumId] });
      qc.invalidateQueries({ queryKey: ["learning-areas", curriculumId] });
      toast.success(`Version ${data.versionNumber} created!`);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create version"),
  });
}

export function useChangeCurriculumVersionStatus(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vId, status }) => curriculumVersionApi.changeStatus(curriculumId, vId, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      if (status === "published") {
        // Publishing can auto-populate this curriculum's competencies/learning areas from
        // every course in the version's content (see CurriculumVersionService.changeStatus)
        // — refresh those too so the Competencies page reflects it without a hard reload.
        qc.invalidateQueries({ queryKey: ["curriculum-competencies", curriculumId] });
        qc.invalidateQueries({ queryKey: ["learning-areas", curriculumId] });
      }
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      toast.success(`Status set to ${label}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update status"),
  });
}
