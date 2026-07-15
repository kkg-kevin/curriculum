import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { competenciesApi } from "../services/competenciesApi";

const STALE = 5 * 60 * 1000; // 5 minutes — data is fresh across tab switches

const KEYS = {
  comps:            (cid) => ["curriculum-competencies", cid],
  indicators:       (cid, compId) => ["curriculum-competency-indicators", cid, compId],
  areas:            (cid) => ["learning-areas", cid],
  ladder:           (cid) => ["progression-ladder", cid],
  ageCats:          (cid) => ["age-categories", cid],
  assessments:      (cid) => ["assessments", cid],
  assessmentTypes:  (cid) => ["assessment-types", cid],
  evidenceTypes:    (cid) => ["evidence-types", cid],
  performanceBands: (cid) => ["performance-bands", cid],
  compWeights:      (cid) => ["competency-weights", cid],
};

/* ── Curriculum ↔ Competency links (competencies are authored in Settings) ── */

export function useCompetencies(curriculumId) {
  return useQuery({
    queryKey:  KEYS.comps(curriculumId),
    queryFn:   () => competenciesApi.getCurriculumCompetencies(curriculumId),
    enabled:   !!curriculumId,
    staleTime: STALE,
  });
}

export function useLinkCompetency(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competencyId) => competenciesApi.linkCompetency(curriculumId, competencyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.comps(curriculumId) });
      toast.success("Competency added to this curriculum");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to add competency"),
  });
}

export function useUnlinkCompetency(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competencyId) => competenciesApi.unlinkCompetency(curriculumId, competencyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.comps(curriculumId) });
      qc.invalidateQueries({ queryKey: KEYS.ladder(curriculumId) });
      toast.success("Competency removed from this curriculum");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to remove competency"),
  });
}

// Threshold is how THIS curriculum evaluates an adopted competency.
export function useUpdateCompetencyLink(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ competencyId, data }) => competenciesApi.updateCompetencyLink(curriculumId, competencyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.comps(curriculumId) });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update competency"),
  });
}

/* ── Competency Indicators (how THIS curriculum evaluates an adopted competency) ── */

export function useCompetencyIndicators(curriculumId, competencyId, enabled = true) {
  return useQuery({
    queryKey:  KEYS.indicators(curriculumId, competencyId),
    queryFn:   () => competenciesApi.getCompetencyIndicators(curriculumId, competencyId),
    enabled:   !!curriculumId && !!competencyId && enabled,
    staleTime: STALE,
  });
}

export function useCreateCompetencyIndicator(curriculumId, competencyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createCompetencyIndicator(curriculumId, competencyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.indicators(curriculumId, competencyId) });
      toast.success("Indicator added");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to add indicator"),
  });
}

export function useUpdateCompetencyIndicator(curriculumId, competencyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateCompetencyIndicator(curriculumId, competencyId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.indicators(curriculumId, competencyId) });
      toast.success("Indicator updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update indicator"),
  });
}

export function useDeleteCompetencyIndicator(curriculumId, competencyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deleteCompetencyIndicator(curriculumId, competencyId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.indicators(curriculumId, competencyId) });
      toast.success("Indicator deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete indicator"),
  });
}

/* ── Learning Areas (grouping for competencies as used within this curriculum) ── */

export function useLearningAreas(curriculumId) {
  return useQuery({
    queryKey:  KEYS.areas(curriculumId),
    queryFn:   () => competenciesApi.getLearningAreas(curriculumId),
    enabled:   !!curriculumId,
    staleTime: STALE,
  });
}

export function useCreateLearningArea(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createLearningArea(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.areas(curriculumId) });
      toast.success("Learning area created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create learning area"),
  });
}

export function useUpdateLearningArea(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateLearningArea(curriculumId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.areas(curriculumId) });
      toast.success("Learning area updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update learning area"),
  });
}

export function useDeleteLearningArea(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deleteLearningArea(curriculumId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.areas(curriculumId) });
      qc.invalidateQueries({ queryKey: KEYS.comps(curriculumId) });
      toast.success("Learning area deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete learning area"),
  });
}

// Clones a learning area from the Settings catalog into this curriculum. The result is
// a brand-new, independent record — editing it afterwards never touches the catalog default.
export function useImportLearningArea(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (learningAreaId) => competenciesApi.importLearningArea(curriculumId, learningAreaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.areas(curriculumId) });
      toast.success("Learning area imported");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to import learning area"),
  });
}

/* ── Progression Ladder ─────────────────────────────────────────────────── */

export function useLadder(curriculumId) {
  return useQuery({
    queryKey:  KEYS.ladder(curriculumId),
    queryFn:   () => competenciesApi.getLadder(curriculumId),
    enabled:   !!curriculumId,
    staleTime: STALE,
  });
}

export function useUpdateLadder(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rungs) => competenciesApi.updateLadder(curriculumId, rungs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.ladder(curriculumId) });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update learning journey"),
  });
}

// Indicators actually tagged in this curriculum's attached assessments, grouped by
// competency — feeds the Performance Bands indicator picker. Always live (no cache
// staleTime override), since it reflects whatever's currently tagged on assessments.
export function usePopulatedIndicators(curriculumId) {
  return useQuery({
    queryKey: ["populated-indicators", curriculumId],
    queryFn:  () => competenciesApi.getPopulatedIndicators(curriculumId),
    enabled:  !!curriculumId,
  });
}

/* ── Age Categories ─────────────────────────────────────────────────────── */

export function useAgeCategories(curriculumId) {
  return useQuery({
    queryKey:  KEYS.ageCats(curriculumId),
    queryFn:   () => competenciesApi.getAgeCategories(curriculumId),
    enabled:   !!curriculumId,
    staleTime: STALE,
  });
}

export function useCreateAgeCategory(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createAgeCategory(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.ageCats(curriculumId) });
      toast.success("Age category created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create age category"),
  });
}

export function useUpdateAgeCategory(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateAgeCategory(curriculumId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.ageCats(curriculumId) });
      toast.success("Age category updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update age category"),
  });
}

export function useDeleteAgeCategory(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deleteAgeCategory(curriculumId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.ageCats(curriculumId) });
      toast.success("Age category deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete age category"),
  });
}

/* ── Assessments ────────────────────────────────────────────────────────── */

export function useCreateAssessment(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createAssessment(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.assessments(curriculumId) });
      toast.success("Assessment created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create assessment"),
  });
}

export function useUpdateAssessment(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateAssessment(curriculumId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.assessments(curriculumId) });
      toast.success("Assessment updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update assessment"),
  });
}

export function useDeleteAssessment(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deleteAssessment(curriculumId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.assessments(curriculumId) });
      toast.success("Assessment deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete assessment"),
  });
}

/* ── Assessment Types ───────────────────────────────────────────────────── */

export function useAssessmentTypes(curriculumId) {
  return useQuery({
    queryKey:  KEYS.assessmentTypes(curriculumId),
    queryFn:   () => competenciesApi.getAssessmentTypes(curriculumId),
    enabled:   !!curriculumId,
    staleTime: STALE,
  });
}

export function useCreateAssessmentType(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createAssessmentType(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.assessmentTypes(curriculumId) });
      toast.success("Assessment type created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create assessment type"),
  });
}

export function useUpdateAssessmentType(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateAssessmentType(curriculumId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.assessmentTypes(curriculumId) });
      toast.success("Assessment type updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update assessment type"),
  });
}

export function useDeleteAssessmentType(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deleteAssessmentType(curriculumId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.assessmentTypes(curriculumId) });
      toast.success("Assessment type deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete assessment type"),
  });
}

export function useUpdateGlobalScoring(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentTypes, competencyWeights }) =>
      competenciesApi.updateGlobalScoring(curriculumId, assessmentTypes, competencyWeights),
    onSuccess: (data) => {
      // Directly populate the cache from the save response — avoids a refetch
      // that could briefly clear typeConfigs and lose the right panel state.
      if (data?.assessmentTypes) {
        qc.setQueryData(KEYS.assessmentTypes(curriculumId), data.assessmentTypes);
      }
      qc.invalidateQueries({ queryKey: KEYS.compWeights(curriculumId) });
      toast.success("Scoring configuration saved");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to save scoring"),
  });
}

/* ── Evidence Types ─────────────────────────────────────────────────────── */

export function useEvidenceTypes(curriculumId) {
  return useQuery({
    queryKey:  KEYS.evidenceTypes(curriculumId),
    queryFn:   () => competenciesApi.getEvidenceTypes(curriculumId),
    enabled:   !!curriculumId,
    staleTime: STALE,
  });
}

export function useCreateEvidenceType(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createEvidenceType(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.evidenceTypes(curriculumId) });
      toast.success("Evidence type created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create evidence type"),
  });
}

export function useUpdateEvidenceType(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateEvidenceType(curriculumId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.evidenceTypes(curriculumId) });
      toast.success("Evidence type updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update evidence type"),
  });
}

export function useDeleteEvidenceType(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deleteEvidenceType(curriculumId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.evidenceTypes(curriculumId) });
      qc.invalidateQueries({ queryKey: KEYS.assessmentTypes(curriculumId) });
      toast.success("Evidence type deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete evidence type"),
  });
}

/* ── Performance Bands ──────────────────────────────────────────────────── */

export function usePerformanceBands(curriculumId) {
  return useQuery({
    queryKey:  KEYS.performanceBands(curriculumId),
    queryFn:   () => competenciesApi.getPerformanceBands(curriculumId),
    enabled:   !!curriculumId,
    staleTime: STALE,
  });
}

export function useCreatePerformanceBand(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createPerformanceBand(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.performanceBands(curriculumId) });
      toast.success("Performance band created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create performance band"),
  });
}

export function useUpdatePerformanceBand(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updatePerformanceBand(curriculumId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.performanceBands(curriculumId) });
      toast.success("Performance band updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update performance band"),
  });
}

export function useDeletePerformanceBand(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deletePerformanceBand(curriculumId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.performanceBands(curriculumId) });
      toast.success("Performance band deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete performance band"),
  });
}

export function useReorderPerformanceBands(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds) => competenciesApi.reorderPerformanceBands(curriculumId, orderedIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.performanceBands(curriculumId) });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to reorder bands"),
  });
}
