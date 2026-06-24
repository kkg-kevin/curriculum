import { useEffect, useMemo } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { classApi } from "../../classes/services/classApi";

const S = {
  form:    { display: "flex", flexDirection: "column", gap: 24 },
  section: { display: "flex", flexDirection: "column", gap: 16 },
  heading: { fontSize: 13, fontWeight: 600, color: "#25476a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 },
  divider: { border: "none", borderTop: "1px solid #a8d5ee", margin: "0 0 8px" },
  row:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  field:   { display: "flex", flexDirection: "column", gap: 6 },
  label:   { fontSize: 13, fontWeight: 500, color: "#374151" },
  input:   { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" },
  select:  { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", cursor: "pointer" },
  error:   { fontSize: 12, color: "#DC2626" },
  hint:    { fontSize: 12, color: "#6B7280" },
};

export default function LearnerForm({ lockedSchoolId = "" }) {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext();

  const schoolId = watch("schoolId");

  const { data: schoolsData } = useSchoolsQuery();
  const schools = schoolsData?.data || [];
  const lockedSchool = lockedSchoolId ? schools.find((s) => s.id === lockedSchoolId) : null;

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", schoolId],
    queryFn:  () => classApi.getAll({ schoolId }),
    enabled:  !!schoolId,
  });
  const classes = (classesData?.data || []).filter((c) => c.status === "active");

  useEffect(() => {
    setValue("classId", "");
  }, [schoolId, setValue]);

  return (
    <div style={S.form}>
      <div style={S.section}>
        <p style={S.heading}>Personal Information</p>
        <hr style={S.divider} />
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>First Name <span style={{ color: "#DC2626" }}>*</span></label>
            <input {...register("firstName")} placeholder="e.g. Jane" style={S.input} />
            {errors.firstName && <span style={S.error}>{errors.firstName.message}</span>}
          </div>
          <div style={S.field}>
            <label style={S.label}>Last Name <span style={{ color: "#DC2626" }}>*</span></label>
            <input {...register("lastName")} placeholder="e.g. Mwangi" style={S.input} />
            {errors.lastName && <span style={S.error}>{errors.lastName.message}</span>}
          </div>
        </div>
        <div style={{ ...S.field, maxWidth: 220 }}>
          <label style={S.label}>Gender <span style={{ color: "#DC2626" }}>*</span></label>
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <select {...field} style={S.select}>
                <option value="">— Select gender —</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            )}
          />
          {errors.gender && <span style={S.error}>{errors.gender.message}</span>}
        </div>
      </div>

      <div style={S.section}>
        <p style={S.heading}>Enrollment</p>
        <hr style={S.divider} />

        {lockedSchoolId ? (
          <div style={S.field}>
            <label style={S.label}>School</label>
            <div style={{ padding: "10px 14px", borderRadius: 8, border: "1.5px solid #a8d5ee", backgroundColor: "#e8f5fb", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {lockedSchool?.name?.[0]?.toUpperCase() || "S"}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
                  {lockedSchool?.name || "Loading…"}
                </p>
                {lockedSchool?.code && <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>{lockedSchool.code}</p>}
              </div>
            </div>
            <input type="hidden" {...register("schoolId")} />
          </div>
        ) : (
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
        )}

        <div style={S.field}>
          <label style={S.label}>Class <span style={{ color: "#DC2626" }}>*</span></label>
          <Controller
            name="classId"
            control={control}
            render={({ field }) => (
              <select {...field} disabled={!schoolId || classes.length === 0} style={{ ...S.select, opacity: !schoolId ? 0.5 : 1 }}>
                <option value="">— Select class —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.gradeName} — {c.academicYear}</option>
                ))}
              </select>
            )}
          />
          {errors.classId && <span style={S.error}>{errors.classId.message}</span>}
          {!schoolId && <span style={S.hint}>Select a school first.</span>}
          {schoolId && classes.length === 0 && <span style={S.hint}>No active classes in this school.</span>}
        </div>

        <div style={{ ...S.field, maxWidth: 220 }}>
          <label style={S.label}>Status</label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <select {...field} style={S.select}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="transferred">Transferred</option>
                <option value="graduated">Graduated</option>
              </select>
            )}
          />
        </div>
      </div>

      <div style={S.section}>
        <p style={S.heading}>Guardian</p>
        <hr style={S.divider} />
        <div style={S.field}>
          <label style={S.label}>Guardian Name <span style={{ color: "#DC2626" }}>*</span></label>
          <input {...register("guardianName")} placeholder="e.g. John Mwangi" style={S.input} />
          {errors.guardianName && <span style={S.error}>{errors.guardianName.message}</span>}
        </div>
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Guardian Phone <span style={{ color: "#DC2626" }}>*</span></label>
            <input {...register("guardianPhone")} placeholder="+254 7XX XXX XXX" style={S.input} />
            {errors.guardianPhone && <span style={S.error}>{errors.guardianPhone.message}</span>}
          </div>
          <div style={S.field}>
            <label style={S.label}>Guardian Email</label>
            <input {...register("guardianEmail")} type="email" placeholder="guardian@email.com" style={S.input} />
            {errors.guardianEmail && <span style={S.error}>{errors.guardianEmail.message}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
