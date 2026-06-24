import { useFormContext } from "react-hook-form";
import { TEACHER_STATUSES } from "../schemas/teacher.schema";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";

const inputStyle = (hasError) => ({
  padding: "10px 12px",
  borderRadius: "10px",
  border: `1.5px solid ${hasError ? "#FCA5A5" : "#E5E7EB"}`,
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: hasError ? "#FFF5F5" : "#F9FAFB",
  color: "#374151",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.15s, background-color 0.15s",
});

const selectStyle = (hasError) => ({
  ...inputStyle(hasError),
  appearance: "none",
  cursor: "pointer",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: "32px",
});

function Field({ label, required, error, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "flex", alignItems: "center", gap: "3px" }}>
        {label}{required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      {children}
      {hint && !error && <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{hint}</p>}
      {error && <p style={{ margin: 0, fontSize: "12px", color: "#EF4444" }}>{error}</p>}
    </div>
  );
}

function TextInput({ name, placeholder, type = "text", label, required, hint }) {
  const { register, formState: { errors } } = useFormContext();
  const keys  = name.split(".");
  const error = keys.reduce((o, k) => o?.[k], errors)?.message;
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <input
        type={type}
        placeholder={placeholder}
        {...register(name)}
        style={inputStyle(!!error)}
        onFocus={(e)  => { e.target.style.borderColor = "#b8d9ee"; e.target.style.backgroundColor = "#fff"; }}
        onBlur={(e)   => { e.target.style.borderColor = error ? "#FCA5A5" : "#E5E7EB"; e.target.style.backgroundColor = error ? "#FFF5F5" : "#F9FAFB"; }}
      />
    </Field>
  );
}

/* ── Main form ────────────────────────────────────────────────────────── */

export default function TeacherForm({ lockedSchoolId = "" }) {
  const { register, formState: { errors } } = useFormContext();
  const { data: schoolsData } = useSchoolsQuery();
  const schools = schoolsData?.data || [];
  const lockedSchool = lockedSchoolId ? schools.find((s) => s.id === lockedSchoolId) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0", backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>

      {/* Personal info */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Personal Information</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <TextInput name="firstName" label="First Name" placeholder="e.g. Jane" required />
            <TextInput name="lastName"  label="Last Name"  placeholder="e.g. Mwangi" required />
          </div>
          <TextInput
            name="employeeId"
            label="Employee ID"
            placeholder="e.g. TCH-001"
            required
            hint="Letters, numbers, and hyphens only"
          />
        </div>
      </div>

      {/* Contact */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Contact Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <TextInput name="email" label="Email Address" placeholder="jane@school.ac.ke" type="email" />
          <TextInput name="phone" label="Phone Number"  placeholder="+254 700 000 000" />
        </div>
      </div>

      {/* School & status */}
      <div style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>School</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {lockedSchoolId ? (
            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "5px" }}>
                School
              </label>
              <div style={{ padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #a8d5ee", backgroundColor: "#F8FAFF", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {lockedSchool?.name?.[0]?.toUpperCase() || "S"}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#111827" }}>
                    {lockedSchool?.name || "Loading…"}
                  </p>
                  {lockedSchool?.code && (
                    <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{lockedSchool.code}</p>
                  )}
                </div>
              </div>
              <input type="hidden" {...register("schoolId")} />
            </div>
          ) : (
            <Field label="School" required error={errors?.schoolId?.message}>
              <select {...register("schoolId")} style={selectStyle(!!errors?.schoolId)}>
                <option value="">Select school…</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
              {schools.length === 0 && (
                <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#F59E0B" }}>
                  No schools found. Add a school first.
                </p>
              )}
            </Field>
          )}

          <div style={{ maxWidth: "220px" }}>
            <Field label="Status" required error={errors?.status?.message}>
              <select {...register("status")} style={selectStyle(!!errors?.status)}>
                {TEACHER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
