import { useFormContext, Controller } from "react-hook-form";
import { TEACHER_STATUSES } from "../schemas/teacher.schema";
import ImageUploadField from "../../../components/ImageUploadField";
import CoursePickerField from "../../courses/components/CoursePickerField";
import PortalPasswordField from "../../../components/PortalPasswordField";
import CollapsibleFormSection from "../../../components/CollapsibleFormSection";

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

export default function TeacherForm() {
  const { register, control, formState: { errors } } = useFormContext();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0", backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>

      {/* Personal info */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Personal Information</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Field label="Photo">
            <Controller
              name="photo"
              control={control}
              render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} width="140px" height="140px" />}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <TextInput name="firstName" label="First Name" placeholder="e.g. Jane" required />
            <TextInput name="lastName"  label="Last Name"  placeholder="e.g. Mwangi" required />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Contact Details</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <TextInput name="email" label="Email Address" placeholder="jane@school.ac.ke" type="email" />
            <TextInput name="phone" label="Phone Number"  placeholder="+254 700 000 000" />
          </div>
          <CollapsibleFormSection label="Set up portal login now">
            <PortalPasswordField
              name="password"
              label="Portal Password"
              hint="Optional — sets up or resets this tech educator's portal login. Leave blank to make no change."
            />
          </CollapsibleFormSection>
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Status</h3>
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

      {/* Qualifications — which courses this educator may be assigned to teach (see
          class.controller.js's assignCourseTeacher). Empty means unrestricted: this educator can
          still be assigned to any course, exactly like before this field existed. */}
      <div style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Qualifications</h3>
        <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#9CA3AF" }}>
          Which courses can this educator be assigned to teach? Leave empty to allow any course.
        </p>
        <Controller
          name="qualifiedCourseIds"
          control={control}
          render={({ field }) => <CoursePickerField value={field.value || []} onChange={field.onChange} />}
        />
      </div>
    </div>
  );
}
