import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLearnerQuery, useUpdateLearner } from "../hooks/useLearners";
import { updateLearnerSchema } from "../schemas/learner.schema";
import LearnerForm from "../components/LearnerForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { useAuth } from "../../../context/AuthContext";
import { learnerPath } from "../../../routes/portalPaths";

const ACCENT = "#25476a";

export default function EditLearnerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: learner, isLoading } = useLearnerQuery(id);
  const { mutate: updateLearner, isPending } = useUpdateLearner();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(updateLearnerSchema),
    defaultValues: {
      firstName: "", lastName: "", gender: "",
      guardianName: "", guardianPhone: "", guardianEmail: "", password: "",
    },
    mode: "onTouched",
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  useEffect(() => {
    if (learner) {
      reset({
        firstName:     learner.firstName     || "",
        lastName:      learner.lastName      || "",
        gender:        learner.gender        || "",
        guardianName:  learner.guardianName  || "",
        guardianPhone: learner.guardianPhone || "",
        guardianEmail: learner.guardianEmail || "",
        password:      "",
      });
    }
  }, [learner, reset]);

  const onSubmit = (data) => {
    updateLearner({ id, data }, {
      onSuccess: () => navigate(learnerPath(user?.role, id, "view")),
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(learnerPath(user?.role, id, "view"));
  };

  if (isLoading) return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  if (!learner)  return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Learner not found.</div>;

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
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{learner.firstName} {learner.lastName}</span>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Edit Learner</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>Update learner details or guardian info. Manage hub enrollment from their profile.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-learner-form"
            disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: !isDirty ? 0.6 : 1 }}
          >
            {isPending ? (
              <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Saving…</>
            ) : "Save Changes"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <FormProvider {...methods}>
          <form id="edit-learner-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
        onConfirm={() => navigate(learnerPath(user?.role, id, "view"))}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
