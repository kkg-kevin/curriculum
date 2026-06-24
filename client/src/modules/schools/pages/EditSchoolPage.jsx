import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSchoolQuery, useUpdateSchool } from "../hooks/useSchool";
import { schoolSchema } from "../schemas/school.schema";
import SchoolForm from "../components/SchoolForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

export default function EditSchoolPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: school, isLoading, isError } = useSchoolQuery(id);
  const { mutate: updateSchool, isPending } = useUpdateSchool();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(schoolSchema),
    mode: "onTouched",
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  useEffect(() => {
    if (school) {
      reset({
        name: school.name || "",
        code: school.code || "",
        email: school.email || "",
        phone: school.phone || "",
        address: {
          street: school.address?.street || "",
          city: school.address?.city || "",
          county: school.address?.county || "",
        },
        curriculumId: school.curriculumId || "",
        status: school.status || "active",
      });
    }
  }, [school, reset]);

  const onSubmit = (data) => {
    const payload = { ...data, curriculumId: data.curriculumId || null };
    updateSchool({ id, data: payload }, {
      onSuccess: () => navigate(`/schools/${id}/view`),
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(`/schools/${id}/view`);
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading school…
      </div>
    );
  }

  if (isError || !school) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ School not found.
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
              onClick={() => navigate(`/schools/${id}/view`)}
              style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              ← {school.name}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Edit School</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Update details or reassign the curriculum.
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
            form="edit-school-form"
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
        <form id="edit-school-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <SchoolForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(`/schools/${id}/view`)}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
