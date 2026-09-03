import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { curriculumVersionApi } from "../services/curriculumVersionApi";

const KEYS = {
  all:            (cid)          => ["curriculum-versions", cid],
  currentCourses: (cid, gradeId) => ["curriculum-versions", cid, "current-courses", gradeId || null],
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
// flat course-curriculum link. Pass a gradeId (the curriculum class's stable id, e.g. a real
// Class record's cls.gradeId) to scope to one grade; omit for every grade.
export function useCurriculumCurrentCourses(curriculumId, gradeId) {
  return useQuery({
    queryKey: KEYS.currentCourses(curriculumId, gradeId),
    queryFn:  () => curriculumVersionApi.getCurrentCourses(curriculumId, gradeId),
    enabled:  !!curriculumId,
  });
}

// Same as above, but for a teacher assigned to more than one class — merges current courses
// across every distinct grade they're the class teacher for (shares cache entries with the
// single-grade hook above, since it's the same query key per grade).
export function useCurriculumCurrentCoursesForGrades(curriculumId, gradeIds) {
  const results = useQueries({
    queries: (gradeIds || []).map((gradeId) => ({
      queryKey: KEYS.currentCourses(curriculumId, gradeId),
      queryFn:  () => curriculumVersionApi.getCurrentCourses(curriculumId, gradeId),
      enabled:  !!curriculumId,
    })),
  });

  const byId = new Map();
  results.forEach((r) => (r.data || []).forEach((c) => byId.set(c.id, c)));

  // Matches every other hook in this file's shape (data/isLoading/isError/error), even though
  // this merges several useQueries results — a consumer that copy-pastes the usual destructure
  // pattern from a sibling hook gets a real isError/error instead of a silent always-undefined.
  return {
    data:      [...byId.values()],
    isLoading: results.some((r) => r.isLoading),
    isError:   results.some((r) => r.isError),
    error:     results.find((r) => r.error)?.error || null,
  };
}

// Same per-grade queries as above, but kept separate per grade instead of merged — for a
// school-wide view that needs to know which specific grade has which courses (e.g. "Grade 1
// has 0 courses"), not just the deduplicated union. Returned Map is keyed by gradeId.
export function useCurriculumCoursesByGrade(curriculumId, gradeIds) {
  const ids = gradeIds || [];
  const results = useQueries({
    queries: ids.map((gradeId) => ({
      queryKey: KEYS.currentCourses(curriculumId, gradeId),
      queryFn:  () => curriculumVersionApi.getCurrentCourses(curriculumId, gradeId),
      enabled:  !!curriculumId,
    })),
  });

  const byGrade = new Map();
  ids.forEach((gradeId, i) => byGrade.set(gradeId, results[i]?.data || []));

  // Same shape-parity note as useCurriculumCurrentCoursesForGrades above.
  return {
    data:      byGrade,
    isLoading: results.some((r) => r.isLoading),
    isError:   results.some((r) => r.isError),
    error:     results.find((r) => r.error)?.error || null,
  };
}

// Courses across several (curriculumId, gradeId) pairs, each possibly a DIFFERENT curriculum —
// for a multi-hub person (teacher/learner) whose hubs don't all share one curriculum, unlike
// useCurriculumCoursesByGrade/useCurriculumCurrentCoursesForGrades above which assume a single
// curriculumId across every grade. Shares cache entries with those hooks (same query key shape
// per pair), so a hub already resolved elsewhere on the page never re-fetches here.
export function useCoursesForPairs(pairs) {
  const list = pairs || [];
  const results = useQueries({
    queries: list.map(({ curriculumId, gradeId }) => ({
      queryKey: KEYS.currentCourses(curriculumId, gradeId),
      queryFn:  () => curriculumVersionApi.getCurrentCourses(curriculumId, gradeId),
      enabled:  !!curriculumId && !!gradeId,
    })),
  });

  const byId = new Map();
  results.forEach((r) => (r.data || []).forEach((c) => byId.set(c.id, c)));

  return {
    data:      byId,
    isLoading: results.some((r) => r.isLoading),
  };
}

export function useCreateCurriculumVersion(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => curriculumVersionApi.create(curriculumId, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEYS.all(curriculumId) });
      // Creating a version can auto-populate this curriculum's competencies/pathways
      // from every course in its content (see CurriculumVersionService.create) — refresh
      // those too so the Competencies page reflects it without a hard reload.
      qc.invalidateQueries({ queryKey: ["curriculum-competencies", curriculumId] });
      qc.invalidateQueries({ queryKey: ["pathways", curriculumId] });
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
        // Publishing can auto-populate this curriculum's competencies/pathways from
        // every course in the version's content (see CurriculumVersionService.changeStatus)
        // — refresh those too so the Competencies page reflects it without a hard reload.
        qc.invalidateQueries({ queryKey: ["curriculum-competencies", curriculumId] });
        qc.invalidateQueries({ queryKey: ["pathways", curriculumId] });
      }
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      toast.success(`Status set to ${label}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update status"),
  });
}
