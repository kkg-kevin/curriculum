import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateProgram } from "../hooks/usePrograms";
import { useCurriculaQuery, useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

const createSchema = z.object({
  curriculumId: z.string().min(1, "Program is required"),
  hubId:        z.string().min(1, "Learning hub is required"),
  startDate:    z.string().min(1, "Start date is required"),
  endDate:      z.string().min(1, "End date is required"),
}).superRefine((data, ctx) => {
  if (data.endDate && data.startDate && data.endDate <= data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be after start date" });
  }
});

const S = {
  card:      { backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 },
  cardTitle: { margin: 0, fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" },
  row:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  field:     { display: "flex", flexDirection: "column", gap: 6 },
  label:     { fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 3 },
  input:     { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" },
  select:    { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", cursor: "pointer" },
  hint:      { fontSize: 12, color: "#6B7280" },
  error:     { fontSize: 12, color: "#DC2626" },
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

  const { register, handleSubmit, watch, formState: { isDirty, errors } } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: { curriculumId: lockedCurriculumId, hubId: "", startDate: "", endDate: "" },
    mode: "onTouched",
  });

  const curriculumId = watch("curriculumId");

  const { data: curriculum } = useCurriculumQuery(curriculumId);
  const gradeNames = curriculum?.classes || [];
  const noCohorts = !!curriculumId && gradeNames.length === 0;

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
            disabled={isPending || noCohorts}
            style={{ padding: "10px 24px", backgroundColor: (isPending || noCohorts) ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: (isPending || noCohorts) ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Deploying…" : "Deploy"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 560 }}>
        <form id="create-program-form" onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Deployment Target</h3>

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
          </div>

          {curriculumId && (
            <div style={{ padding: "14px 18px", borderRadius: 14, border: `1.5px solid ${noCohorts ? "#FECACA" : "#a8d5ee"}`, backgroundColor: noCohorts ? "#FFF5F5" : "#F0F7FF", display: "flex", flexDirection: "column", gap: 10 }}>
              {noCohorts ? (
                <p style={{ margin: 0, fontSize: 13, color: "#DC2626" }}>
                  This program has no cohorts defined yet — add one on its Structure step first.
                </p>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 13, color: "#25476a", fontWeight: 600 }}>
                    A class will be created automatically for each cohort below
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {gradeNames.map((name) => (
                      <span key={name} style={{ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: "#ffffff", border: "1.5px solid #a8d5ee", color: "#25476a" }}>
                        {name}
                      </span>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#5b7a99" }}>
                    Already defined on the program's Structure step — no need to pick again here. Assign a tech educator and
                    capacity for each class afterward, from the Classes module.
                  </p>
                </>
              )}
            </div>
          )}

          <div style={S.card}>
            <h3 style={S.cardTitle}>Timeline</h3>
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
