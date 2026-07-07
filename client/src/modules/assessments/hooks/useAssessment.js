import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { assessmentApi } from "../services/assessmentApi";

export const ASSESSMENT_KEYS = {
  all: ["assessments"],
  detail: (id) => ["assessments", "detail", id],
  competencies: (id) => ["assessments", "competencies", id],
  learningAreas: (id) => ["assessments", "learning-areas", id],
  inventory: (id) => ["assessments", "inventory", id],
};

// Zod validation issues come back from the API as { path: ["items", 2, "options"], message }
// (see server/src/modules/assessments/assessment.validation.js) — turn that into "Item 3: Add at
// least 2 options" instead of the generic "Validation failed" the top-level message alone gives.
const ARRAY_FIELD_LABELS = {
  items: "Item", indicators: "Indicator", rubric: "Rubric criterion",
  deliverables: "Deliverable", milestones: "Milestone", sections: "Section",
};

function describeAssessmentError(err, fallback) {
  const issues = err.errors;
  if (!Array.isArray(issues) || issues.length === 0) return err.message || fallback;
  const described = issues.map((issue) => {
    const [field, index] = issue.path || [];
    const label = ARRAY_FIELD_LABELS[field];
    return label && typeof index === "number" ? `${label} ${index + 1}: ${issue.message}` : issue.message;
  });
  return described.length > 1 ? `${described[0]} (+${described.length - 1} more)` : described[0];
}

export function useAssessmentsQuery() {
  return useQuery({
    queryKey: ASSESSMENT_KEYS.all,
    queryFn: () => assessmentApi.getAll(),
  });
}

export function useAssessmentQuery(id) {
  return useQuery({
    queryKey: ASSESSMENT_KEYS.detail(id),
    queryFn: () => assessmentApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assessmentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.all });
      toast.success("Assessment created successfully!");
    },
    onError: (err) => {
      toast.error(describeAssessmentError(err, "Failed to create assessment"));
    },
  });
}

export function useUpdateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => assessmentApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.detail(data.id) });
      toast.success("Assessment updated successfully!");
    },
    onError: (err) => {
      toast.error(describeAssessmentError(err, "Failed to update assessment"));
    },
  });
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assessmentApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.all });
      toast.success("Assessment deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete assessment");
    },
  });
}

/* ── Competencies (authored globally in Settings, tagged onto an assessment here) ── */

export function useAssessmentCompetencies(assessmentId) {
  return useQuery({
    queryKey: ASSESSMENT_KEYS.competencies(assessmentId),
    queryFn: () => assessmentApi.getAssessmentCompetencies(assessmentId),
    enabled: !!assessmentId,
  });
}

/* ── Learning Areas (authored globally in Settings, tagged onto an assessment here) ── */

export function useAssessmentLearningAreas(assessmentId) {
  return useQuery({
    queryKey: ASSESSMENT_KEYS.learningAreas(assessmentId),
    queryFn: () => assessmentApi.getAssessmentLearningAreas(assessmentId),
    enabled: !!assessmentId,
  });
}

/* ── Inventory (authored globally in Settings, linked onto a project here with a quantity) ── */

export function useAssessmentInventory(assessmentId) {
  return useQuery({
    queryKey: ASSESSMENT_KEYS.inventory(assessmentId),
    queryFn: () => assessmentApi.getAssessmentInventory(assessmentId),
    enabled: !!assessmentId,
  });
}
