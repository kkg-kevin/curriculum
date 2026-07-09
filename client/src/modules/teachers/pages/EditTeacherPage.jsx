import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTeacherQuery, useUpdateTeacher } from "../hooks/useTeacher";
import { teacherSchema } from "../schemas/teacher.schema";
import TeacherForm from "../components/TeacherForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { useAuth } from "../../../context/AuthContext";
import { teacherPath } from "../../../routes/portalPaths";

export default function EditTeacherPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: teacher, isLoading, isError } = useTeacherQuery(id);
  const { mutate: updateTeacher, isPending } = useUpdateTeacher();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(teacherSchema),
    mode: "onTouched",
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  useEffect(() => {
    if (teacher) {
      reset({
        firstName:  teacher.firstName  || "",
        lastName:   teacher.lastName   || "",
        employeeId: teacher.employeeId || "",
        email:      teacher.email      || "",
        phone:      teacher.phone      || "",
        schoolId:   teacher.schoolId   || "",
        status:     teacher.status     || "active",
      });
    }
  }, [teacher, reset]);

  const onSubmit = (data) => {
    updateTeacher({ id, data }, {
      onSuccess: () => navigate(teacherPath(user?.role, id, "view")),
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(teacherPath(user?.role, id, "view"));
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading teacher…
      </div>
    );
  }

  if (isError || !teacher) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Teacher not found.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <button type="button" onClick={() => navigate(teacherPath(user?.role, id, "view"))} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← {teacher.firstName} {teacher.lastName}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Edit Teacher</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
            Update teacher details or school assignment.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-teacher-form"
            disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#b8d9ee" : "#25476a", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "background-color 0.15s" }}
          >
            {isPending ? (
              <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Saving…</>
            ) : "Save Changes"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <FormProvider {...methods}>
        <form id="edit-teacher-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <TeacherForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(teacherPath(user?.role, id, "view"))}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
