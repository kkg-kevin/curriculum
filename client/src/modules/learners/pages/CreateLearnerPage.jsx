import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateLearner } from "../hooks/useLearners";
import { createLearnerSchema } from "../schemas/learner.schema";
import LearnerForm from "../components/LearnerForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#BE185D";

const DEFAULT_VALUES = {
  firstName: "", lastName: "", gender: "",
  schoolId: "", classId: "",
  guardianName: "", guardianPhone: "", guardianEmail: "",
  status: "active",
};

export default function CreateLearnerPage() {
  const navigate = useNavigate();
  const { mutate: createLearner, isPending } = useCreateLearner();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(createLearnerSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit, formState: { isDirty } } = methods;

  const onSubmit = (data) => {
    createLearner(data, {
      onSuccess: (learner) => navigate(`/learners/${learner.id}/view`),
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/learners");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Learners
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Enroll Learner</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            Fill in the learner's details. An admission number will be auto-generated.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-learner-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#F472B6" : ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background-color 0.15s" }}
          >
            {isPending ? (
              <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Enrolling…</>
            ) : "Enroll Learner"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <FormProvider {...methods}>
          <form id="create-learner-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <LearnerForm />
          </form>
        </FormProvider>
      </div>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate("/learners")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
