import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateAssessment } from "../hooks/useAssessment";
import { useTemplates } from "../hooks/useTemplates";
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

const selectStyle = {
  width: "100%", padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #a8d5ee",
  fontSize: "13px", fontFamily: "Inter, sans-serif", backgroundColor: "#fff", color: "#25476a",
  outline: "none", cursor: "pointer",
};

function TemplatePicker({ type, onApply }) {
  const { data: templates = [] } = useTemplates(type);
  const [selected, setSelected] = useState("");

  if (!type) return null;

  return (
    <div style={{ padding: "12px 14px", backgroundColor: "#F0F7FF", border: "1.5px solid #C7D9F8", borderRadius: "10px" }}>
      <label style={{ fontSize: "12px", fontWeight: "700", color: "#25476a", display: "block", marginBottom: "6px" }}>
        Start from a template <span style={{ fontWeight: 400, color: "#6B7280" }}>(optional)</span>
      </label>
      {templates.length === 0 ? (
        <p style={{ margin: 0, fontSize: "12.5px", color: "#6B7280" }}>
          No templates yet for this type.{" "}
          <Link to="/settings" style={{ color: "#38aae1", fontWeight: "600", textDecoration: "none" }}>Create one in Settings →</Link>
        </p>
      ) : (
        <select
          value={selected}
          onChange={(e) => {
            const id = e.target.value;
            setSelected(id);
            if (id) onApply(templates.find((t) => t.id === id));
          }}
          style={selectStyle}
        >
          <option value="">Select a template…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
    </div>
  );
}

export default function CreateAssessmentPage() {
  const navigate = useNavigate();
  const { mutate: createAssessment, isPending } = useCreateAssessment();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState(null);

  const methods = useForm({
    resolver: zodResolver(assessmentSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit, watch, setValue, formState: { isDirty } } = methods;
  const type = watch("type");

  // Applied content is type-specific (items vs rubric vs indicators) — if the user
  // switches type after picking a template, the stashed content no longer applies.
  useEffect(() => { setAppliedTemplate(null); }, [type]);

  const applyTemplate = (template) => {
    if (template.instructions) setValue("instructions", template.instructions, { shouldDirty: true });
    setAppliedTemplate(template);
  };

  const onSubmit = ({ competencyIds, learningAreaIds, ...data }) => {
    createAssessment(data, {
      onSuccess: async (assessment) => {
        if (competencyIds.length > 0) {
          await Promise.all(competencyIds.map((cid) => assessmentApi.linkCompetency(assessment.id, cid)));
        }
        if (learningAreaIds.length > 0) {
          await Promise.all(learningAreaIds.map((aid) => assessmentApi.linkLearningArea(assessment.id, aid)));
        }
        if (appliedTemplate) {
          await Promise.all([
            ...(appliedTemplate.items || []).map((item) => assessmentApi.addItem(assessment.id, item)),
            ...(appliedTemplate.rubric || []).map((c) => assessmentApi.addRubricCriterion(assessment.id, c)),
            ...(appliedTemplate.indicators || []).map((ind) => assessmentApi.addIndicator(assessment.id, ind)),
          ]);
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
          <AssessmentForm afterType={<TemplatePicker key={type} type={type} onApply={applyTemplate} />} />
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
