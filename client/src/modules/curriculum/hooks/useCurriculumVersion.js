import { useMemo } from "react";
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

// The courses a curriculum's pathways may be given: every course on its published version or a
// draft one (never only a retired one) — the server's CurriculumVersionService.versionCourseIds.
// `ids` is null while loading or when the curriculum has no published/draft version yet.
export function useVersionCourseIds(curriculumId) {
  const query = useCurriculumVersions(curriculumId);
  const ids = useMemo(() => {
    const { current, history = [] } = query.data || {};
    const usable = [current, ...history].filter((v) => v && (v.isCurrent || ["published", "draft"].includes(v.status)));
    if (!usable.length) return null;
    const set = new Set();
    usable.forEach((v) => (v.content || []).forEach((p) => (p.classes || []).forEach((c) => (c.courses || []).forEach((course) => set.add(course.id)))));
    return set;
  }, [query.data]);
  return { ids, isLoading: query.isLoading };
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

// The courses of each class from the class's OWN curriculum + grade — a hub's classes don't all
// share the hub's curriculum: the Home Learning hub has none of its own and every child's class
// carries the curriculum they were placed on. A class without one falls back to the hub's
// (`fallbackCurriculumId`). `forClass(cls)` → that class's courses; `courses` → every course across
// the classes, once each; `hasCurriculum` → at least one class has a curriculum to show.
export function useClassCourses(classes, fallbackCurriculumId) {
  const curriculumOf = (cls) => cls?.curriculumId || fallbackCurriculumId || null;
  const pairs = [];
  const seen = new Set();
  for (const cls of classes || []) {
    const curriculumId = curriculumOf(cls);
    if (!curriculumId || !cls.gradeId) continue;
    const key = `${curriculumId}:${cls.gradeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ key, curriculumId, gradeId: cls.gradeId });
  }
  const results = useQueries({
    queries: pairs.map(({ curriculumId, gradeId }) => ({
      queryKey: KEYS.currentCourses(curriculumId, gradeId),
      queryFn:  () => curriculumVersionApi.getCurrentCourses(curriculumId, gradeId),
    })),
  });

  // Rebuilt only when a result changes, so `forClass` and `courses` are stable enough for the
  // useMemo dependencies of the pages using them.
  const stamp = pairs.map((p, i) => `${p.key}@${results[i]?.dataUpdatedAt || 0}`).join("|");
  const value = useMemo(() => {
    const byPair = new Map(pairs.map((p, i) => [p.key, results[i]?.data || []]));
    const byId = new Map();
    byPair.forEach((list) => list.forEach((c) => byId.set(c.id, c)));
    return {
      courses: [...byId.values()],
      forClass: (cls) => byPair.get(`${curriculumOf(cls)}:${cls?.gradeId}`) || [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, fallbackCurriculumId]);

  return {
    ...value,
    hasCurriculum: pairs.length > 0 || Boolean(fallbackCurriculumId),
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
