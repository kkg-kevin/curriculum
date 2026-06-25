import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { competenciesApi } from "../services/competenciesApi";

const KEYS = {
  areas:       (cid) => ["learning-areas", cid],
  comps:       (cid) => ["competencies", cid],
  ladder:      (cid) => ["progression-ladder", cid],
  ageCats:     (cid) => ["age-categories", cid],
  levels:      (cid) => ["progress-levels", cid],
  assessments: (cid) => ["assessments", cid],
};

/* ── Learning Areas ─────────────────────────────────────────────────────── */

export function useLearningAreas(curriculumId) {
  return useQuery({
    queryKey: KEYS.areas(curriculumId),
    queryFn:  () => competenciesApi.getLearningAreas(curriculumId),
    enabled:  !!curriculumId,
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

/* ── Competencies ───────────────────────────────────────────────────────── */

export function useCompetencies(curriculumId) {
  return useQuery({
    queryKey: KEYS.comps(curriculumId),
    queryFn:  () => competenciesApi.getCompetencies(curriculumId),
    enabled:  !!curriculumId,
  });
}

export function useCreateCompetency(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createCompetency(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.comps(curriculumId) });
      toast.success("Competency created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create competency"),
  });
}

export function useUpdateCompetency(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateCompetency(curriculumId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.comps(curriculumId) });
      toast.success("Competency updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update competency"),
  });
}

export function useDeleteCompetency(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deleteCompetency(curriculumId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.comps(curriculumId) });
      qc.invalidateQueries({ queryKey: KEYS.ladder(curriculumId) });
      toast.success("Competency deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete competency"),
  });
}

/* ── Progression Ladder ─────────────────────────────────────────────────── */

export function useLadder(curriculumId) {
  return useQuery({
    queryKey: KEYS.ladder(curriculumId),
    queryFn:  () => competenciesApi.getLadder(curriculumId),
    enabled:  !!curriculumId,
  });
}

export function useUpdateLadder(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rungs) => competenciesApi.updateLadder(curriculumId, rungs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.ladder(curriculumId) });
      toast.success("Progression ladder saved");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to save ladder"),
  });
}

/* ── Age Categories ─────────────────────────────────────────────────────── */

export function useAgeCategories(curriculumId) {
  return useQuery({
    queryKey: KEYS.ageCats(curriculumId),
    queryFn:  () => competenciesApi.getAgeCategories(curriculumId),
    enabled:  !!curriculumId,
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

/* ── Progress Levels ────────────────────────────────────────────────────── */

export function useProgressLevels(curriculumId) {
  return useQuery({
    queryKey: KEYS.levels(curriculumId),
    queryFn:  () => competenciesApi.getProgressLevels(curriculumId),
    enabled:  !!curriculumId,
  });
}

export function useCreateProgressLevel(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competenciesApi.createProgressLevel(curriculumId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.levels(curriculumId) });
      toast.success("Level created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create level"),
  });
}

export function useUpdateProgressLevel(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => competenciesApi.updateProgressLevel(curriculumId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.levels(curriculumId) });
      toast.success("Level updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update level"),
  });
}

export function useDeleteProgressLevel(curriculumId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => competenciesApi.deleteProgressLevel(curriculumId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.levels(curriculumId) });
      toast.success("Level deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete level"),
  });
}

/* ── Assessments ────────────────────────────────────────────────────────── */

export function useAssessments(curriculumId) {
  return useQuery({
    queryKey: KEYS.assessments(curriculumId),
    queryFn:  () => competenciesApi.getAssessments(curriculumId),
    enabled:  !!curriculumId,
  });
}

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
