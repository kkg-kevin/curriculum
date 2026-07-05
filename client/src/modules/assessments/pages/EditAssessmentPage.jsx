import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAssessmentQuery, useUpdateAssessment, useAssessmentCompetencies, useAssessmentLearningAreas, ASSESSMENT_KEYS } from "../hooks/useAssessment";
import { assessmentSchema } from "../schemas/assessment.schema";
import AssessmentForm from "../components/AssessmentForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { assessmentApi } from "../services/assessmentApi";

export default function EditAssessmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: assessment, isLoading, isError } = useAssessmentQuery(id);
  const { data: linkedCompetencies, isLoading: competenciesLoading } = useAssessmentCompetencies(id);
  const { data: linkedLearningAreas, isLoading: learningAreasLoading } = useAssessmentLearningAreas(id);
  const { mutate: updateAssessment, isPending } = useUpdateAssessment();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(assessmentSchema),
    mode: "onTouched",
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  useEffect(() => {
    if (assessment && linkedCompetencies && linkedLearningAreas) {
      reset({
        name: assessment.name || "",
        description: assessment.description || "",
        type: assessment.type || "",
        instructions: assessment.instructions || "",
        competencyIds: linkedCompetencies.map((c) => c.id),
        learningAreaIds: linkedLearningAreas.map((a) => a.id),
      });
    }
  }, [assessment, linkedCompetencies, linkedLearningAreas, reset]);

  const onSubmit = ({ competencyIds, learningAreaIds, ...data }) => {
    updateAssessment({ id, data }, {
      onSuccess: async () => {
        const originalIds = (linkedCompetencies || []).map((c) => c.id);
        const toAdd = competencyIds.filter((cid) => !originalIds.includes(cid));
        const toRemove = originalIds.filter((cid) => !competencyIds.includes(cid));
        const originalAreaIds = (linkedLearningAreas || []).map((a) => a.id);
        const areasToAdd = learningAreaIds.filter((aid) => !originalAreaIds.includes(aid));
        const areasToRemove = originalAreaIds.filter((aid) => !learningAreaIds.includes(aid));
        await Promise.all([
          ...toAdd.map((cid) => assessmentApi.linkCompetency(id, cid)),
          ...toRemove.map((cid) => assessmentApi.unlinkCompetency(id, cid)),
          ...areasToAdd.map((aid) => assessmentApi.linkLearningArea(id, aid)),
          ...areasToRemove.map((aid) => assessmentApi.unlinkLearningArea(id, aid)),
        ]);
        queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.competencies(id) });
        queryClient.invalidateQueries({ queryKey: ASSESSMENT_KEYS.learningAreas(id) });
        navigate(`/assessments/${id}/view`);
      },
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(`/assessments/${id}/view`);
  };

  if (isLoading || competenciesLoading || learningAreasLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading assessment…
      </div>
    );
  }

  if (isError || !assessment) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Assessment not found.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <button
              type="button"
              onClick={() => navigate(`/assessments/${id}/view`)}
              style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              ← {assessment.name}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Edit Assessment</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Update the assessment details.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-assessment-form"
            disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "background-color 0.15s" }}
          >
            {isPending ? (
              <>
                <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#ffffff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                Saving…
              </>
            ) : "Save Changes"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <FormProvider {...methods}>
        <form id="edit-assessment-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <AssessmentForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(`/assessments/${id}/view`)}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
