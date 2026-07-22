import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateLearningHub } from "../../../learning-hubs/hooks/useLearningHub";
import { learningHubSchema } from "../../../learning-hubs/schemas/learningHub.schema";
import LearningHubForm from "../components/LearningHubForm";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

export default function CreateLearningHubPage() {
  const navigate = useNavigate();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const { mutate: createLearningHub, isPending } = useCreateLearningHub();

  const methods = useForm({
    resolver: zodResolver(learningHubSchema),
    defaultValues: {
      name: "", hubType: "school", code: "",
      address: { street: "", city: "", county: "" },
      mapLink: "",
      contactPerson: "", email: "", password: "", phone: "",
      curriculumId: "", status: "draft",
      description: "", photos: [], amenities: [],
      operatingHours: { opensAt: "", closesAt: "", days: [] },
      spaces: [],
    },
    mode: "onTouched",
  });

  const { handleSubmit, formState: { isDirty } } = methods;

  const onSubmit = (data) => {
    const payload = { ...data, curriculumId: data.curriculumId || null };
    createLearningHub(payload, {
      onSuccess: () => navigate("/settings?tab=learning-hubs"),
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/settings?tab=learning-hubs");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "#F5F7FA",
          paddingTop: "2px",
          paddingBottom: "14px",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Settings
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Add Learning Hub</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
            Register a physical place and, optionally, assign it its own curriculum. It starts as a draft until you activate it.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-learning-hub-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            {isPending ? (
              <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Saving…</>
            ) : "Save Learning Hub"}
          </button>
        </div>
      </div>

      <FormProvider {...methods}>
        <form id="create-learning-hub-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <LearningHubForm autoGenerateCode />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate("/settings?tab=learning-hubs")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
