import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTeacher } from "../hooks/useTeacher";
import { teacherSchema } from "../schemas/teacher.schema";
import TeacherForm from "../components/TeacherForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import PasswordRevealDialog from "../../../components/ui/PasswordRevealDialog";
import { useAuth } from "../../../context/AuthContext";
import { teachersListPath, teacherPath } from "../../../routes/portalPaths";

const ACCENT = "#25476a";

export default function CreateTeacherPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const lockedSchoolId = searchParams.get("schoolId") || "";

  const { mutate: createTeacher, isPending } = useCreateTeacher();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [passwordReveal, setPasswordReveal] = useState(null);

  const methods = useForm({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      firstName: "", lastName: "",
      email: "", password: "", phone: "",
      status: "active",
      employmentType: null, teacherLevel: null, paymentTerms: null,
      photo: null,
      qualifiedCourseIds: [],
    },
    mode: "onTouched",
  });

  const { handleSubmit, formState: { isDirty } } = methods;

  const onSubmit = (data) => {
    const payload = lockedSchoolId ? { ...data, hubId: lockedSchoolId } : data;
    createTeacher(payload, {
      onSuccess: (teacher) => {
        const viewPath = teacherPath(user?.role, teacher.id, "view");
        if (data.password) {
          setPasswordReveal({ password: data.password, name: `${teacher.firstName} ${teacher.lastName}`, navigateTo: viewPath });
        } else {
          navigate(viewPath);
        }
      },
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(teachersListPath(user?.role, lockedSchoolId));
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Educators
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Add Educator</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
            Fill in the educator's details. Course assignments happen afterward, from the class's own page.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-teacher-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "background-color 0.15s" }}
          >
            {isPending ? (
              <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Saving…</>
            ) : "Save Educator"}
          </button>
        </div>
      </div>

      <FormProvider {...methods}>
        <form id="create-teacher-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <TeacherForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(teachersListPath(user?.role, lockedSchoolId))}
        onCancel={() => setConfirmLeave(false)}
      />

      <PasswordRevealDialog
        isOpen={!!passwordReveal}
        password={passwordReveal?.password}
        subjectName={passwordReveal?.name}
        onClose={() => { navigate(passwordReveal.navigateTo); setPasswordReveal(null); }}
      />
    </div>
  );
}
