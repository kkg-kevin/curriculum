import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useCreateClass, useBulkCreateClasses } from "../hooks/useClasses";
import { useLearningHubQuery as useSchoolQuery } from "../../learning-hubs/hooks/useLearningHub";
import { learningHubApi as schoolApi } from "../../learning-hubs/services/learningHubApi";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useAuth } from "../../../context/AuthContext";
import { classesListPath, classPath, gradeStreamsPath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

// "Blue, Red, Green" → one class per name — lets a grade's whole set of parallel streams be
// opened in a single submit instead of repeating "+ Add Stream" once per name.
function parseStreamNames(raw) {
  return (raw || "").split(",").map((s) => s.trim()).filter(Boolean);
}

const createSchema = z.object({
  schoolId:       z.string().min(1, "School is required"),
  gradeName:      z.string().min(1, "Grade is required"),
  academicYear:   z.string().min(1, "Academic year is required"),
  capacity:       z.coerce.number().int().positive().nullable().optional(),
  status:         z.enum(["active", "inactive"]).default("active"),
  tag:            z.string().trim().optional(),
  streamName:     z.string().trim().optional(),
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
  // Set from GradeStreamsPage's "+ Add Stream" button — prefills (not locks) Grade/Academic
  // Year so adding another stream to a grade that already has one doesn't require re-picking
  // both from scratch, but they're still editable in case that's not actually what's wanted.
  const prefillGradeName    = searchParams.get("gradeName") || "";
  const prefillAcademicYear = searchParams.get("academicYear");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const { mutate: createClass, isPending: creatingOne } = useCreateClass();
  const { mutate: bulkCreateClasses, isPending: creatingBulk } = useBulkCreateClasses();
  const isPending = creatingOne || creatingBulk;

  const { data: lockedSchool } = useSchoolQuery(lockedSchoolId);
  // Only needed for the admin no-schoolId case (school picker dropdown below) — skip the
  // fetch entirely when a school is already locked in via the query string.
  const { data: allSchoolsData } = useQuery({
    queryKey: ["learningHubs", "all"],
    queryFn: () => schoolApi.getAll(),
    enabled: !lockedSchoolId,
  });
  const schools = allSchoolsData?.data || [];

  const { register, control, handleSubmit, watch, setError, formState: { isDirty, errors } } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: {
      schoolId: lockedSchoolId, gradeName: prefillGradeName, academicYear: prefillAcademicYear || String(new Date().getFullYear()),
      capacity: null, status: "active", tag: "", streamName: "",
    },
    mode: "onTouched",
  });

  const selectedSchoolId = lockedSchoolId || watch("schoolId");
  const { data: selectedSchool } = useSchoolQuery(selectedSchoolId);
  const school = lockedSchoolId ? lockedSchool : selectedSchool;
  const { data: curriculum } = useCurriculumQuery(school?.curriculumId);
  const curriculumClasses = curriculum?.classes || [];

  const backPath = classesListPath(user?.role, lockedSchoolId);
  const streamNames = parseStreamNames(watch("streamName"));

  const onSubmit = (data) => {
    const gradeId = curriculumClasses.find((c) => c.name === data.gradeName)?.id;
    const names = parseStreamNames(data.streamName);
    const base = { ...data, curriculumId: school.curriculumId, gradeId, tag: data.tag?.trim() || null };

    if (names.length > 1) {
      if (base.tag) {
        setError("tag", { message: "Tag can only be set for a single class — leave it blank when adding several streams at once." });
        return;
      }
      const items = names.map((streamName) => ({ ...base, streamName }));
      bulkCreateClasses(items, {
        onSuccess: () => navigate(gradeStreamsPath(user?.role, school.id, gradeId, data.academicYear)),
      });
      return;
    }

    const payload = { ...base, streamName: names[0] || null };
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
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>Open one or more one-off classes outside of Set Up Year.</p>
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
            {isPending ? "Saving…" : streamNames.length > 1 ? `Save ${streamNames.length} Classes` : "Save Class"}
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
                <select {...register("gradeName")} style={S.select} disabled={!curriculumClasses.length}>
                  <option value="">{curriculumClasses.length ? "Select grade…" : "No grades available"}</option>
                  {curriculumClasses.map((cls) => <option key={cls.id} value={cls.name}>{cls.name}</option>)}
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
              <label style={S.label}>Stream</label>
              <input {...register("streamName")} style={S.input} placeholder="e.g. Blue, Red, Green, Yellow — leave blank if this grade has only one class" />
              <span style={S.hint}>
                Required only if this grade already has another class at this school for this year — splits it into parallel sections, each with its own roster, attendance, and educators.
                {" "}Separate names with a comma to open several streams at once (e.g. "Blue, Red, Green, Yellow").
              </span>
              {errors.streamName && <span style={S.error}>{errors.streamName.message}</span>}
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

            <div style={S.field}>
              <label style={S.label}>Tag</label>
              <input
                {...register("tag")}
                style={S.input}
                disabled={streamNames.length > 1}
                placeholder={streamNames.length > 1 ? "Not available when opening several streams at once" : "e.g. HUB-A-G1 (optional, must be unique)"}
              />
              <span style={S.hint}>A short code unique to this class instance — lets you tell it apart from same-named classes at other hubs.</span>
              {errors.tag && <span style={S.error}>{errors.tag.message}</span>}
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
