import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useClassQuery, useUpdateClass } from "../hooks/useClasses";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { teacherApi } from "../../teachers/services/teacherApi";
import { useAuth } from "../../../context/AuthContext";
import { classPath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

const editSchema = z.object({
  classTeacherId: z.string().nullable().optional(),
  capacity:       z.coerce.number().int().positive().nullable().optional(),
  status:         z.enum(["active", "inactive"]).default("active"),
});

const S = {
  section: { display: "flex", flexDirection: "column", gap: 16 },
  heading: { fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" },
  divider: { border: "none", borderTop: "1px solid #a8d5ee", margin: "0 0 8px" },
  row:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  field:   { display: "flex", flexDirection: "column", gap: 6 },
  label:   { fontSize: 13, fontWeight: 500, color: "#374151" },
  input:   { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" },
  select:  { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", cursor: "pointer" },
  hint:    { fontSize: 12, color: "#6B7280" },
  error:   { fontSize: 12, color: "#DC2626" },
};

export default function EditClassPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const { data: cls, isLoading } = useClassQuery(id);
  const { mutate: updateClass, isPending } = useUpdateClass();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const { data: curriculum } = useCurriculumQuery(cls?.curriculumId);

  const { data: teachersData } = useQuery({
    queryKey: ["teachers", "bySchool", cls?.schoolId],
    queryFn:  () => teacherApi.getAll({ schoolId: cls.schoolId }),
    enabled:  !!cls?.schoolId,
  });
  const activeTeachers = (teachersData?.data || []).filter((t) => t.status === "active");

  const { register, control, handleSubmit, reset, formState: { isDirty, errors } } = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: { classTeacherId: null, capacity: null, status: "active" },
    mode: "onTouched",
  });

  useEffect(() => {
    if (cls) {
      reset({
        classTeacherId: cls.classTeacherId || null,
        capacity:       cls.capacity       || null,
        status:         cls.status         || "active",
      });
    }
  }, [cls, reset]);

  const onSubmit = (data) => {
    updateClass({ id, data }, { onSuccess: () => navigate(classPath(user?.role, id, "view")) });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(classPath(user?.role, id, "view"));
  };

  if (isLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }
  if (!cls) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Class not found.</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Classes
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{cls.gradeName}</span>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Edit Class</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>Assign a class teacher, set capacity, or change status.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-class-form"
            disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: !isDirty ? 0.6 : 1 }}
          >
            {isPending ? (
              <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Saving…</>
            ) : "Save Changes"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 580 }}>
        {/* Read-only context */}
        <div style={{ backgroundColor: "#F8FAFF", border: "1.5px solid #a8d5ee", borderRadius: 14, padding: "18px 20px", marginBottom: 24 }}>
          <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Class — read only</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "Grade",         value: cls.gradeName },
              { label: "Academic Year", value: cls.academicYear },
              { label: "Curriculum",    value: curriculum?.name || "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#374151" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Editable form */}
        <form id="edit-class-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={S.section}>
            <p style={S.heading}>Assign &amp; Configure</p>
            <hr style={S.divider} />

            <div style={S.field}>
              <label style={S.label}>Class Teacher</label>
              <Controller
                name="classTeacherId"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    style={S.select}
                  >
                    <option value="">— None —</option>
                    {activeTeachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                    ))}
                  </select>
                )}
              />
              <span style={S.hint}>Only active teachers at this school are shown.</span>
            </div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Capacity</label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 40 (leave blank for unlimited)"
                  {...register("capacity", { valueAsNumber: true })}
                  style={S.input}
                />
                {errors.capacity && <span style={S.error}>{errors.capacity.message}</span>}
              </div>

              <div style={S.field}>
                <label style={S.label}>Status</label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <select {...field} style={S.select}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  )}
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(classPath(user?.role, id, "view"))}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
