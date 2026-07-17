import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useCreateClass } from "../hooks/useClasses";
import { useSchoolQuery } from "../../schools/hooks/useSchool";
import { schoolApi } from "../../schools/services/schoolApi";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { teacherApi } from "../../teachers/services/teacherApi";
import { useAuth } from "../../../context/AuthContext";
import { classesListPath, classPath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

const createSchema = z.object({
  schoolId:       z.string().min(1, "School is required"),
  gradeName:      z.string().min(1, "Grade is required"),
  academicYear:   z.string().min(1, "Academic year is required"),
  classTeacherId: z.string().nullable().optional(),
  capacity:       z.coerce.number().int().positive().nullable().optional(),
  status:         z.enum(["active", "inactive"]).default("active"),
});

const S = {
  section: { display: "flex", flexDirection: "column", gap: 16 },
  row:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  field:   { display: "flex", flexDirection: "column", gap: 6 },
  label:   { fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 3 },
  input:   { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" },
  select:  { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", cursor: "pointer" },
  hint:    { fontSize: 12, color: "#6B7280" },
  error:   { fontSize: 12, color: "#DC2626" },
};

export default function CreateClassPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const lockedSchoolId = searchParams.get("schoolId") || "";
  const [confirmLeave, setConfirmLeave] = useState(false);

  const { mutate: createClass, isPending } = useCreateClass();

  const { data: lockedSchool } = useSchoolQuery(lockedSchoolId);
  // Only needed for the admin no-schoolId case (school picker dropdown below) — skip the
  // fetch entirely when a school is already locked in via the query string.
  const { data: allSchoolsData } = useQuery({
    queryKey: ["schools", "all"],
    queryFn: () => schoolApi.getAll({}),
    enabled: !lockedSchoolId,
  });
  const schools = allSchoolsData?.data || [];

  const { register, control, handleSubmit, watch, formState: { isDirty, errors } } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: {
      schoolId: lockedSchoolId, gradeName: "", academicYear: String(new Date().getFullYear()),
      classTeacherId: null, capacity: null, status: "active",
    },
    mode: "onTouched",
  });

  const selectedSchoolId = lockedSchoolId || watch("schoolId");
  const { data: selectedSchool } = useSchoolQuery(selectedSchoolId);
  const school = lockedSchoolId ? lockedSchool : selectedSchool;
  const { data: curriculum } = useCurriculumQuery(school?.curriculumId);
  const gradeNames = curriculum?.classes || [];

  const { data: teachersData } = useQuery({
    queryKey: ["teachers", "bySchool", selectedSchoolId],
    queryFn:  () => teacherApi.getAll({ schoolId: selectedSchoolId }),
    enabled:  !!selectedSchoolId,
  });
  const activeTeachers = (teachersData?.data || []).filter((t) => t.status === "active");

  const backPath = classesListPath(user?.role, lockedSchoolId);

  const onSubmit = (data) => {
    const gradeId = `${school.curriculumId.slice(0, 8)}-${data.gradeName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const payload = { ...data, curriculumId: school.curriculumId, gradeId };
    createClass(payload, { onSuccess: (record) => navigate(classPath(user?.role, record.id, "view")) });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(backPath);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Classes
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Add Class</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>Open a single one-off class outside of Set Up Year.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-class-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Saving…" : "Save Class"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 580 }}>
        <form id="create-class-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={S.section}>
            {lockedSchoolId ? (
              <div style={S.field}>
                <label style={S.label}>School</label>
                <div style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #a8d5ee", backgroundColor: "#F8FAFF", fontSize: 14, fontWeight: 600, color: "#111827" }}>
                  {lockedSchool?.name || "Loading…"} {lockedSchool?.code ? `(${lockedSchool.code})` : ""}
                </div>
                <input type="hidden" {...register("schoolId")} />
              </div>
            ) : (
              <div style={S.field}>
                <label style={S.label}>School <span style={{ color: "#EF4444" }}>*</span></label>
                <select {...register("schoolId")} style={S.select}>
                  <option value="">Select school…</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
                {errors.schoolId && <span style={S.error}>{errors.schoolId.message}</span>}
              </div>
            )}

            {school && !school.curriculumId && (
              <p style={{ margin: 0, fontSize: 13, color: "#92400E", backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "10px 14px" }}>
                This school has no curriculum assigned yet — grades can't be listed until one is.
              </p>
            )}

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Grade <span style={{ color: "#EF4444" }}>*</span></label>
                <select {...register("gradeName")} style={S.select} disabled={!gradeNames.length}>
                  <option value="">{gradeNames.length ? "Select grade…" : "No grades available"}</option>
                  {gradeNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                {errors.gradeName && <span style={S.error}>{errors.gradeName.message}</span>}
              </div>
              <div style={S.field}>
                <label style={S.label}>Academic Year <span style={{ color: "#EF4444" }}>*</span></label>
                <input {...register("academicYear")} style={S.input} placeholder="e.g. 2026" />
                {errors.academicYear && <span style={S.error}>{errors.academicYear.message}</span>}
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Class Teacher</label>
              <Controller
                name="classTeacherId"
                control={control}
                render={({ field }) => (
                  <select value={field.value || ""} onChange={(e) => field.onChange(e.target.value || null)} style={S.select}>
                    <option value="">— None —</option>
                    {activeTeachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                  </select>
                )}
              />
              <span style={S.hint}>Only active teachers at this school are shown. Optional — can be assigned later.</span>
            </div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Capacity</label>
                <input type="number" min={1} placeholder="Leave blank for unlimited" {...register("capacity", { valueAsNumber: true })} style={S.input} />
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
        onConfirm={() => navigate(backPath)}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
