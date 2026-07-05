import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateAssessment } from "../hooks/useAssessment";
import { assessmentSchema } from "../schemas/assessment.schema";
import AssessmentForm from "../components/AssessmentForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { assessmentApi } from "../services/assessmentApi";

const DEFAULT_VALUES = {
  name: "",
  description: "",
  type: "",
  instructions: "",
  competencyIds: [],
  learningAreaIds: [],
};

export default function CreateAssessmentPage() {
  const navigate = useNavigate();
  const { mutate: createAssessment, isPending } = useCreateAssessment();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(assessmentSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit, formState: { isDirty } } = methods;

  const onSubmit = ({ competencyIds, learningAreaIds, ...data }) => {
    createAssessment(data, {
      onSuccess: async (assessment) => {
        if (competencyIds.length > 0) {
          await Promise.all(competencyIds.map((cid) => assessmentApi.linkCompetency(assessment.id, cid)));
        }
        if (learningAreaIds.length > 0) {
          await Promise.all(learningAreaIds.map((aid) => assessmentApi.linkLearningArea(assessment.id, aid)));
        }
        navigate(`/assessments/${assessment.id}/view`);
      },
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/assessments");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{ display: "flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              ← Assessments
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Add Assessment</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Create an assessment from scratch.
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
            form="create-assessment-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "background-color 0.15s" }}
          >
            {isPending ? (
              <>
                <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#ffffff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                Saving...
              </>
            ) : "Save Assessment"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <FormProvider {...methods}>
        <form id="create-assessment-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <AssessmentForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate("/assessments")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
