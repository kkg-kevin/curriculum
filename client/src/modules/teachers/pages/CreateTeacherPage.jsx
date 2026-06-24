import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateTeacher } from "../hooks/useTeacher";
import { CLASS_KEYS } from "../../classes/hooks/useClasses";
import { teacherSchema } from "../schemas/teacher.schema";
import { classApi } from "../../classes/services/classApi";
import { teacherApi } from "../services/teacherApi";
import TeacherForm from "../components/TeacherForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

function ClassCheckbox({ cls, teachersMap, selected, onToggle }) {
  const currentTeacher = cls.classTeacherId ? teachersMap[cls.classTeacherId] : null;
  return (
    <label
      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${selected ? ACCENT : "#E5E7EB"}`, backgroundColor: selected ? "#e8f5fb" : "#FAFAFA", cursor: "pointer", transition: "all 0.15s" }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        style={{ marginTop: 2, accentColor: ACCENT, flexShrink: 0, width: 16, height: 16, cursor: "pointer" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: selected ? ACCENT : "#111827" }}>{cls.gradeName}</p>
        <p style={{ margin: "1px 0 0", fontSize: 12, color: "#9CA3AF" }}>{cls.academicYear} · {cls.learnerCount ?? 0} learner{(cls.learnerCount ?? 0) !== 1 ? "s" : ""}</p>
        {currentTeacher && (
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#F59E0B" }}>
            Currently: {currentTeacher.firstName} {currentTeacher.lastName} — will be replaced
          </p>
        )}
      </div>
    </label>
  );
}

export default function CreateTeacherPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const lockedSchoolId = searchParams.get("schoolId") || "";

  const { mutate: createTeacher, isPending } = useCreateTeacher();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState(new Set());

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", lockedSchoolId],
    queryFn:  () => classApi.getAll({ schoolId: lockedSchoolId }),
    enabled:  !!lockedSchoolId,
  });

  const { data: allTeachersData } = useQuery({
    queryKey: ["teachers", "bySchool", lockedSchoolId],
    queryFn:  () => teacherApi.getAll({ schoolId: lockedSchoolId }),
    enabled:  !!lockedSchoolId,
  });

  const schoolClasses = (classesData?.data || []).filter((c) => c.status === "active");
  const teachersMap = Object.fromEntries((allTeachersData?.data || []).map((t) => [t.id, t]));

  const methods = useForm({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      firstName: "", lastName: "", employeeId: "",
      email: "", phone: "",
      schoolId: lockedSchoolId, status: "active",
    },
    mode: "onTouched",
  });

  const { handleSubmit, formState: { isDirty } } = methods;

  const toggleClass = (id) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onSubmit = (data) => {
    createTeacher(data, {
      onSuccess: async (teacher) => {
        if (selectedClassIds.size > 0) {
          await Promise.all(
            [...selectedClassIds].map((classId) =>
              classApi.update(classId, { classTeacherId: teacher.id })
            )
          );
          qc.invalidateQueries({ queryKey: CLASS_KEYS.all });
        }
        navigate(`/teachers/${teacher.id}/view`);
      },
    });
  };

  const handleCancel = () => {
    if (isDirty || selectedClassIds.size > 0) setConfirmLeave(true);
    else navigate("/teachers");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Teachers
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Add Teacher</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
            Fill in the teacher's details and optionally assign them to one or more classes.
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
            ) : "Save Teacher"}
          </button>
        </div>
      </div>

      <FormProvider {...methods}>
        <form id="create-teacher-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <TeacherForm lockedSchoolId={lockedSchoolId} />
        </form>
      </FormProvider>

      {lockedSchoolId && schoolClasses.length > 0 && (
        <div style={{ marginTop: 20, backgroundColor: "#ffffff", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #F3F4F6" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>
              Assign to Classes
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: "#9CA3AF" }}>optional</span>
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
              Select which classes this teacher will be the class teacher for.
              {selectedClassIds.size > 0 && (
                <span style={{ marginLeft: 8, color: ACCENT, fontWeight: 600 }}>{selectedClassIds.size} selected</span>
              )}
            </p>
          </div>
          <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
            {schoolClasses.map((cls) => (
              <ClassCheckbox
                key={cls.id}
                cls={cls}
                teachersMap={teachersMap}
                selected={selectedClassIds.has(cls.id)}
                onToggle={() => toggleClass(cls.id)}
              />
            ))}
          </div>
        </div>
      )}

      {lockedSchoolId && schoolClasses.length === 0 && classesData && (
        <div style={{ marginTop: 20, padding: "16px 20px", backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 12, fontSize: 13, color: "#92400E" }}>
          No active classes in this school yet. Set up classes first to assign this teacher.
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate("/teachers")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
