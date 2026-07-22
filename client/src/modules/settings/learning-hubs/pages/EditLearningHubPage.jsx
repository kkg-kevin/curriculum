import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLearningHubQuery, useUpdateLearningHub } from "../../../learning-hubs/hooks/useLearningHub";
import { learningHubSchema } from "../../../learning-hubs/schemas/learningHub.schema";
import LearningHubForm from "../components/LearningHubForm";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

export default function EditLearningHubPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: hub, isLoading, isError } = useLearningHubQuery(id);
  const { mutate: updateLearningHub, isPending } = useUpdateLearningHub();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(learningHubSchema),
    mode: "onTouched",
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  useEffect(() => {
    if (hub) {
      reset({
        name: hub.name || "",
        hubType: hub.hubType || "school",
        code: hub.code || "",
        address: {
          street: hub.address?.street || "",
          city: hub.address?.city || "",
          county: hub.address?.county || "",
        },
        mapLink: hub.mapLink || "",
        contactPerson: hub.contactPerson || "",
        email: hub.email || "",
        password: "",
        phone: hub.phone || "",
        curriculumId: hub.curriculumId || "",
        status: hub.status || "active",
        description: hub.description || "",
        photos: hub.photos || [],
        amenities: hub.amenities || [],
        operatingHours: {
          opensAt: hub.operatingHours?.opensAt || "",
          closesAt: hub.operatingHours?.closesAt || "",
          days: hub.operatingHours?.days || [],
        },
        spaces: hub.spaces || [],
      });
    }
  }, [hub, reset]);

  const onSubmit = (data) => {
    const payload = { ...data, curriculumId: data.curriculumId || null };
    updateLearningHub({ id, data: payload }, {
      onSuccess: () => navigate(`/learning-hubs/${id}/view`),
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(`/learning-hubs/${id}/view`);
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading learning hub…
      </div>
    );
  }

  if (isError || !hub) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Learning hub not found.
      </div>
    );
  }

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
              ← {hub.name}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Edit Learning Hub</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>Update learning hub details or reassign its curriculum.</p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-learning-hub-form"
            disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#b8d9ee" : "#25476a", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            {isPending ? (
              <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Saving…</>
            ) : "Save Changes"}
          </button>
        </div>
      </div>

      <FormProvider {...methods}>
        <form id="edit-learning-hub-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <LearningHubForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(`/learning-hubs/${id}/view`)}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
