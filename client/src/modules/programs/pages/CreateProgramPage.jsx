import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateProgram } from "../hooks/usePrograms";
import { useCurriculaQuery, useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useAllLearningHubsQuery, useHubTeachersQuery } from "../../learning-hubs/hooks/useLearningHub";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

const createSchema = z.object({
  curriculumId:   z.string().min(1, "Program is required"),
  hubId:          z.string().min(1, "Learning hub is required"),
  gradeName:      z.string().min(1, "Cohort/grade is required"),
  startDate:      z.string().min(1, "Start date is required"),
  endDate:        z.string().min(1, "End date is required"),
  classTeacherId: z.string().nullable().optional(),
  capacity:       z.coerce.number().int().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.endDate && data.startDate && data.endDate <= data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be after start date" });
  }
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

export default function CreateProgramPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lockedCurriculumId = searchParams.get("curriculumId") || "";
  const [confirmLeave, setConfirmLeave] = useState(false);

  const { mutate: createProgram, isPending } = useCreateProgram();
  const { data: curriculaData } = useCurriculaQuery();
  const { data: hubsData } = useAllLearningHubsQuery({});
  const programCurricula = (curriculaData?.data || []).filter((c) => c.isProgram);
  const hubs = hubsData?.data || [];

  const { register, control, handleSubmit, watch, formState: { isDirty, errors } } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: {
      curriculumId: lockedCurriculumId, hubId: "", gradeName: "", startDate: "", endDate: "",
      classTeacherId: null, capacity: null,
    },
    mode: "onTouched",
  });

  const curriculumId = watch("curriculumId");
  const hubId = watch("hubId");

  const { data: curriculum } = useCurriculumQuery(curriculumId);
  const gradeNames = curriculum?.classes || [];

  const { data: hubTeachers } = useHubTeachersQuery(hubId);
  const activeTeachers = (hubTeachers || []).filter((t) => t.status === "active");

  const onSubmit = (data) => {
    createProgram(data, { onSuccess: (record) => navigate(`/programs/${record.id}/view`) });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/programs");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Programs
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>Deploy</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Deploy Program</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            Put an already-authored program curriculum onto a hub as a real running cohort.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-program-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Deploying…" : "Deploy"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 580 }}>
        <form id="create-program-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={S.section}>
            {lockedCurriculumId ? (
              <div style={S.field}>
                <label style={S.label}>Program</label>
                <div style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #a8d5ee", backgroundColor: "#F8FAFF", fontSize: 14, fontWeight: 600, color: "#111827" }}>
                  {curriculum?.name || "Loading…"}
                </div>
                <input type="hidden" {...register("curriculumId")} />
              </div>
            ) : (
              <div style={S.field}>
                <label style={S.label}>Program <span style={{ color: "#EF4444" }}>*</span></label>
                <select {...register("curriculumId")} style={S.select} disabled={!programCurricula.length}>
                  <option value="">{programCurricula.length ? "Select program…" : "No programs authored yet"}</option>
                  {programCurricula.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.curriculumId && <span style={S.error}>{errors.curriculumId.message}</span>}
              </div>
            )}

            <div style={S.field}>
              <label style={S.label}>Learning Hub <span style={{ color: "#EF4444" }}>*</span></label>
              <select {...register("hubId")} style={S.select}>
                <option value="">Select learning hub…</option>
                {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              {errors.hubId && <span style={S.error}>{errors.hubId.message}</span>}
            </div>

            <div style={S.field}>
              <label style={S.label}>Cohort / Grade <span style={{ color: "#EF4444" }}>*</span></label>
              <select {...register("gradeName")} style={S.select} disabled={!curriculumId || !gradeNames.length}>
                <option value="">{!curriculumId ? "Select a program first" : gradeNames.length ? "Select cohort…" : "No cohorts defined on this program's Structure step"}</option>
                {gradeNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <span style={S.hint}>Defined on the program curriculum's Structure step, same as a grade on a normal curriculum.</span>
              {errors.gradeName && <span style={S.error}>{errors.gradeName.message}</span>}
            </div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Start Date <span style={{ color: "#EF4444" }}>*</span></label>
                <input type="date" {...register("startDate")} style={S.input} />
                {errors.startDate && <span style={S.error}>{errors.startDate.message}</span>}
              </div>
              <div style={S.field}>
                <label style={S.label}>End Date <span style={{ color: "#EF4444" }}>*</span></label>
                <input type="date" {...register("endDate")} style={S.input} />
                {errors.endDate && <span style={S.error}>{errors.endDate.message}</span>}
              </div>
            </div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Class Tech Educator</label>
                <Controller
                  name="classTeacherId"
                  control={control}
                  render={({ field }) => (
                    <select value={field.value || ""} onChange={(e) => field.onChange(e.target.value || null)} style={S.select} disabled={!hubId}>
                      <option value="">— None —</option>
                      {activeTeachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                    </select>
                  )}
                />
                <span style={S.hint}>Only active tech educators at the selected hub are shown. Optional.</span>
              </div>
              <div style={S.field}>
                <label style={S.label}>Capacity</label>
                <input type="number" min={1} placeholder="Leave blank for unlimited" {...register("capacity", { valueAsNumber: true })} style={S.input} />
                {errors.capacity && <span style={S.error}>{errors.capacity.message}</span>}
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
        onConfirm={() => navigate("/programs")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
