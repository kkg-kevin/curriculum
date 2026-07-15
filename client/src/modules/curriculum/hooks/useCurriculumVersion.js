import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
