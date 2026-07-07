import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { competenciesApi } from "../services/competenciesApi";

const STALE = 5 * 60 * 1000;

export const COMPETENCY_KEYS = {
  comps: ["settings", "competencies"],
};

// Query key prefixes used by OTHER modules that consume this shared catalog by
// reference (never by copy — see the competencies integration plan). Any create/
// update/delete here must invalidate these too, or a module that already fetched
// its cached view (e.g. a curriculum's Competencies tab) would keep showing stale
// names/descriptions until its own staleTime expires.
const CROSS_MODULE_KEYS = [
  ["curriculum-competencies"],     // client/src/modules/curriculum/hooks/useCompetencies.js
  ["courses", "competencies"],     // client/src/modules/courses/hooks/useCourse.js
  ["assessments", "competencies"], // client/src/modules/assessments/hooks/useAssessment.js
];

function invalidateEverywhere(qc) {
  qc.invalidateQueries({ queryKey: COMPETENCY_KEYS.comps });
  CROSS_MODULE_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

/* ── Competencies ───────────────────────────────────────────────────────── */

export function useCompetencies() {
  return useQuery({
    queryKey:  COMPETENCY_KEYS.comps,
    queryFn:   competenciesApi.getCompetencies,
    staleTime: STALE,
  });
}

export function useCreateCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competenciesApi.createCompetency,
    onSuccess: () => {
      invalidateEverywhere(qc);
      toast.success("Competency created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create competency"),
  });
}

export function useUpdateCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateCompetency(id, data),
    onSuccess: () => {
      invalidateEverywhere(qc);
      toast.success("Competency updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update competency"),
  });
}

export function useDeleteCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competenciesApi.deleteCompetency,
    onSuccess: () => {
      invalidateEverywhere(qc);
      toast.success("Competency deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete competency"),
  });
}
