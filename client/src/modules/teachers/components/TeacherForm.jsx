import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { TEACHER_STATUSES, EMPLOYMENT_TYPES, TEACHER_LEVELS, PAYMENT_TERMS } from "../schemas/teacher.schema";
import ImageUploadField from "../../../components/ImageUploadField";

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

// Sets up (or resets) the teacher-portal login password for this teacher's email, right from
// this form — a shortcut instead of a separate signup. Left blank, nothing about any existing
// login changes.
function PasswordField() {
  const { register, formState: { errors } } = useFormContext();
  const [show, setShow] = useState(false);
  const error = errors?.password?.message;

  return (
    <Field label="Portal Password" error={error} hint="Optional — sets up or resets this tech educator's portal login. Leave blank to make no change.">
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          {...register("password")}
          style={{ ...inputStyle(!!error), paddingRight: "44px" }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", padding: "4px" }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}

// A nullable classification select — renders a "— Not set —" option and coerces the empty
// string back to null (numeric option values back to Number) since a native <select> only
// ever emits strings. Placeholder fields for now — nothing reads these yet.
function NullableSelect({ name, label, options, numeric = false, hint }) {
  const { register, formState: { errors } } = useFormContext();
  const error = errors?.[name]?.message;
  return (
    <Field label={label} error={error} hint={hint}>
      <select
        {...register(name, { setValueAs: (v) => (v === "" ? null : numeric ? Number(v) : v) })}
        style={selectStyle(!!error)}
      >
        <option value="">— Not set —</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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
          <PasswordField />
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

      {/* Employment — placeholder classification fields; the full employment/payroll feature
          (rates, computed pay, etc.) isn't built yet, this just holds the data for it. */}
      <div style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Employment</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <NullableSelect name="employmentType" label="Employment Type" options={EMPLOYMENT_TYPES} />
          <NullableSelect name="teacherLevel" label="Educator Level" options={TEACHER_LEVELS} numeric />
          <NullableSelect name="paymentTerms" label="Payment Terms" options={PAYMENT_TERMS} />
        </div>
      </div>
    </div>
  );
}
