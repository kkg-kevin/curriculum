import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateClass } from "../hooks/useClasses";
import { createClassSchema } from "../schemas/class.schema";
import ClassForm from "../components/ClassForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#EA580C";

const DEFAULT_VALUES = {
  schoolId: "", curriculumId: "", gradeId: "", gradeName: "",
  classTeacherId: null, academicYear: String(new Date().getFullYear()),
  capacity: null, status: "active",
};

export default function CreateClassPage() {
  const navigate = useNavigate();
  const { mutate: createClass, isPending } = useCreateClass();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(createClassSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit, formState: { isDirty } } = methods;

  const onSubmit = (data) => {
    createClass(data, {
      onSuccess: (cls) => navigate(`/classes/${cls.id}/view`),
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/classes");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Classes
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Create Class</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            Select a school and grade, then assign a class teacher.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-class-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#FB923C" : ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background-color 0.15s" }}
          >
            {isPending ? (
              <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Saving…</>
            ) : "Save Class"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <FormProvider {...methods}>
          <form id="create-class-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <ClassForm />
          </form>
        </FormProvider>
      </div>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate("/classes")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
