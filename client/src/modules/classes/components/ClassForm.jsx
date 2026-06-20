import { useEffect, useMemo } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { teacherApi } from "../../teachers/services/teacherApi";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(String);

const S = {
  form:    { display: "flex", flexDirection: "column", gap: 24 },
  section: { display: "flex", flexDirection: "column", gap: 16 },
  heading: { fontSize: 13, fontWeight: 600, color: "#EA580C", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 },
  divider: { border: "none", borderTop: "1px solid #FED7AA", margin: "0 0 8px" },
  row:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  field:   { display: "flex", flexDirection: "column", gap: 6 },
  label:   { fontSize: 13, fontWeight: 500, color: "#374151" },
  input:   { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" },
  select:  { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", cursor: "pointer" },
  error:   { fontSize: 12, color: "#DC2626" },
  hint:    { fontSize: 12, color: "#6B7280" },
};

export default function ClassForm() {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext();

  const schoolId     = watch("schoolId");
  const curriculumId = watch("curriculumId");

  const { data: schoolsData }    = useSchoolsQuery();
  const schools                  = schoolsData?.data || [];

  const { data: curriculum }     = useCurriculumQuery(curriculumId);

  const { data: teachersData }   = useQuery({
    queryKey: ["teachers", "bySchool", schoolId],
    queryFn:  () => teacherApi.getAll({ schoolId }),
    enabled:  !!schoolId,
  });
  const allTeachers = teachersData?.data || [];
  const activeTeachers = allTeachers.filter((t) => t.status === "active");

  const selectedSchool = useMemo(
    () => schools.find((s) => s.id === schoolId),
    [schools, schoolId]
  );

  useEffect(() => {
    if (selectedSchool?.curriculumId) {
      setValue("curriculumId", selectedSchool.curriculumId, { shouldValidate: true });
    } else {
      setValue("curriculumId", "");
    }
    setValue("gradeId", "");
    setValue("gradeName", "");
    setValue("classTeacherId", null);
  }, [schoolId, selectedSchool, setValue]);

  const grades = useMemo(() => {
    if (!curriculum?.structure) return [];
    const seen = new Set();
    const result = [];
    for (const block of curriculum.structure) {
      for (const grade of (block.grades || [])) {
        if (!seen.has(grade.id)) {
          seen.add(grade.id);
          result.push(grade);
        }
      }
    }
    return result;
  }, [curriculum]);

  const handleGradeChange = (gradeId) => {
    const found = grades.find((g) => g.id === gradeId);
    setValue("gradeId", gradeId, { shouldValidate: true });
    setValue("gradeName", found?.name || "");
  };

  return (
    <div style={S.form}>
      <div style={S.section}>
        <p style={S.heading}>School &amp; Curriculum</p>
        <hr style={S.divider} />

        <div style={S.field}>
          <label style={S.label}>School <span style={{ color: "#DC2626" }}>*</span></label>
          <Controller
            name="schoolId"
            control={control}
            render={({ field }) => (
              <select {...field} style={S.select}>
                <option value="">— Select school —</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          />
          {errors.schoolId && <span style={S.error}>{errors.schoolId.message}</span>}
        </div>

        <div style={S.field}>
          <label style={S.label}>Curriculum</label>
          <input
            readOnly
            value={curriculumId ? (curriculum?.name ?? "Loading…") : "Auto-filled from school"}
            style={{ ...S.input, background: "#F9FAFB", color: "#6B7280", cursor: "not-allowed" }}
          />
          <span style={S.hint}>Automatically set from the selected school.</span>
        </div>

        <div style={S.field}>
          <label style={S.label}>Grade <span style={{ color: "#DC2626" }}>*</span></label>
          <Controller
            name="gradeId"
            control={control}
            render={({ field }) => (
              <select
                value={field.value || ""}
                onChange={(e) => handleGradeChange(e.target.value)}
                disabled={!curriculumId || grades.length === 0}
                style={{ ...S.select, opacity: !curriculumId ? 0.5 : 1 }}
              >
                <option value="">— Select grade —</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          />
          {errors.gradeId && <span style={S.error}>{errors.gradeId.message}</span>}
          {!curriculumId && <span style={S.hint}>Select a school first.</span>}
        </div>
      </div>

      <div style={S.section}>
        <p style={S.heading}>Class Details</p>
        <hr style={S.divider} />

        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Academic Year <span style={{ color: "#DC2626" }}>*</span></label>
            <Controller
              name="academicYear"
              control={control}
              render={({ field }) => (
                <select {...field} style={S.select}>
                  <option value="">— Select year —</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}
            />
            {errors.academicYear && <span style={S.error}>{errors.academicYear.message}</span>}
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

        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Class Teacher</label>
            <Controller
              name="classTeacherId"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value || ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  disabled={!schoolId}
                  style={{ ...S.select, opacity: !schoolId ? 0.5 : 1 }}
                >
                  <option value="">— None —</option>
                  {activeTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                  ))}
                </select>
              )}
            />
            {!schoolId && <span style={S.hint}>Select a school first.</span>}
          </div>

          <div style={S.field}>
            <label style={S.label}>Capacity</label>
            <input
              type="number"
              min={1}
              placeholder="e.g. 40 (leave blank for unlimited)"
              {...register("capacity", { valueAsNumber: true })}
              style={S.input}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
