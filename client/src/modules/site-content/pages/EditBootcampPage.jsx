import { useState, useEffect } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useBootcampsQuery, useUpdateBootcamp } from "../hooks/useSiteContent";
import { bootcampSchema } from "../schemas/siteContent.schema";
import BootcampForm from "../components/BootcampForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

// No GET /api/site/bootcamps/:id on the server (list/create/update/delete only — see
// admin-site.routes.js) — the record to edit is looked up from the already-fetched list.
export default function EditBootcampPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBootcampsQuery();
  const { mutate: updateBootcamp, isPending } = useUpdateBootcamp();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const bootcamp = (data?.data || []).find((b) => b.id === id);

  const methods = useForm({
    resolver: zodResolver(bootcampSchema),
    mode: "onTouched",
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  useEffect(() => {
    if (bootcamp) {
      reset({
        name: bootcamp.name || "",
        description: bootcamp.description || "",
        coverImage: bootcamp.coverImage || null,
        status: bootcamp.status || "upcoming",
        startDate: bootcamp.startDate || "",
        endDate: bootcamp.endDate || "",
        educationLevel: bootcamp.educationLevel || "",
        gradeFrom: bootcamp.gradeFrom || "",
        gradeTo: bootcamp.gradeTo || "",
        classes: bootcamp.classes || [],
        courses: bootcamp.courses || [],
        isPublished: bootcamp.isPublished ?? true,
      });
    }
  }, [bootcamp, reset]);

  const onSubmit = (formData) => {
    updateBootcamp({ id, data: formData }, { onSuccess: () => navigate("/site-content") });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/site-content");
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading bootcamp…
      </div>
    );
  }

  if (isError || !bootcamp) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px", display: "flex", alignItems: "center", gap: 8 }}>
        <FiAlertTriangle size={15} /> Bootcamp not found.
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
              onClick={() => navigate("/site-content")}
              style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              ← {bootcamp.name}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Edit Bootcamp</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Update the bootcamp details.
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
            form="edit-bootcamp-form"
            disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <FormProvider {...methods}>
        <form id="edit-bootcamp-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <BootcampForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate("/site-content")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
