import { useFormContext, Controller } from "react-hook-form";
import ImageUploadField from "../../../components/ImageUploadField";
import MultiSelectChips from "../../../components/MultiSelectChips";
import PortalPasswordField from "../../../components/PortalPasswordField";
import CollapsibleFormSection from "../../../components/CollapsibleFormSection";
import { NATIONALITIES, LANGUAGES } from "../schemas/learner.schema";

// Mirrors client/src/modules/learner-portal/components/profile/ProfileIdentityCard.jsx's
// computeAge — display-only, derived live from whatever date of birth is currently typed in.
function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Same visual language as TeacherForm.jsx (bordered card sections, same input/select styling) —
// kept as local copies rather than a further-shared file since these two forms' field sets don't
// overlap beyond that; PortalPasswordField/CollapsibleFormSection are the pieces that actually
// need to behave identically across both, so those are the ones that got extracted.
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
  const error = errors?.[name]?.message;
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

// A learner is an independent identity, same as a teacher — no school/class field lives here.
// Enrollment (which hub, which class, admission number, status) is managed separately, per
// hub, from the learner's own detail page (see the "Learning Hubs" section on LearnerViewPage).
export default function LearnerForm() {
  const { register, control, watch, formState: { errors } } = useFormContext();
  const age = computeAge(watch("dateOfBirth"));

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
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "12px" }}>
            <Field label="Gender" required error={errors?.gender?.message}>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <select {...field} style={selectStyle(!!errors?.gender)}>
                    <option value="">— Select gender —</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                )}
              />
            </Field>
            <Field
              label="Date of Birth"
              error={errors?.dateOfBirth?.message}
              hint={age !== null ? `Age: ${age} year${age !== 1 ? "s" : ""}` : undefined}
            >
              <input type="date" {...register("dateOfBirth")} style={inputStyle(!!errors?.dateOfBirth)} />
            </Field>
          </div>
          <Field label="Nationality" error={errors?.nationality?.message}>
            <select {...register("nationality")} style={selectStyle(!!errors?.nationality)}>
              <option value="">— Select nationality —</option>
              {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Languages" error={errors?.languages?.message}>
            <Controller
              name="languages"
              control={control}
              render={({ field }) => (
                <MultiSelectChips
                  options={LANGUAGES}
                  value={field.value ? field.value.split(",").map((v) => v.trim()).filter(Boolean) : []}
                  onChange={(next) => field.onChange(next.join(", "))}
                />
              )}
            />
          </Field>
        </div>
      </div>

      {/* Guardian */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Guardian</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <TextInput name="guardianName" label="Guardian Name" placeholder="e.g. John Mwangi" required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <TextInput name="guardianPhone" label="Guardian Phone" placeholder="+254 7XX XXX XXX" required />
            <TextInput name="guardianEmail" label="Guardian Email" placeholder="guardian@email.com" type="email" />
          </div>
          <CollapsibleFormSection label="Set up guardian portal login">
            <PortalPasswordField
              name="password"
              label="Guardian Portal Password"
              hint="Optional — sets up or resets this learner's guardian portal login. Leave blank to make no change."
            />
          </CollapsibleFormSection>
        </div>
      </div>

      {/* Learner's own login — a genuinely separate credential from the guardian's above, most
          learners don't need one set up right away, so it stays collapsed by default. */}
      <div style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Learner Portal Login</h3>
        <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#9CA3AF" }}>
          A separate login the learner can use themselves, distinct from the guardian's above.
        </p>
        {/* Auto-opens once a username loads on the edit form (see CollapsibleFormSection's own
            comment) so an already-configured learner login is never hidden by default — only
            stays collapsed for a genuinely new learner who has none yet. */}
        <CollapsibleFormSection label="Set up a separate learner login" defaultOpen={!!watch("username")}>
          <TextInput
            name="username"
            label="Student Username"
            placeholder="e.g. grace.wambui"
            hint="Without a password below, this username still logs into the guardian's account above; with one, it's the learner's own separate login."
          />
          <PortalPasswordField
            name="learnerPassword"
            label="Learner Portal Password"
            hint="Optional — sets up or resets the learner's OWN separate login (not the guardian's). Requires a username. Leave blank to make no change."
          />
        </CollapsibleFormSection>
      </div>
    </div>
  );
}
