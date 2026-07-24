import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";

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

// Sets up (or resets) the guardian's learner-portal login for guardianEmail, right from this
// form — a shortcut instead of a separate signup. Left blank, nothing about any existing
// login changes.
function GuardianPasswordField() {
  const { register, formState: { errors } } = useFormContext();
  const [show, setShow] = useState(false);
  const error = errors?.password?.message;

  return (
    <div style={S.field}>
      <label style={S.label}>Guardian Portal Password</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          {...register("password")}
          style={{ ...S.input, width: "100%", boxSizing: "border-box", paddingRight: 52 }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", padding: 4 }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {error ? <span style={S.error}>{error}</span> : <span style={S.hint}>Optional — sets up or resets this learner's guardian portal login. Leave blank to make no change.</span>}
    </div>
  );
}

// A learner is an independent identity, same as a teacher — no school/class field lives here.
// Enrollment (which hub, which class, admission number, status) is managed separately, per
// hub, from the learner's own detail page (see the "Learning Hubs" section on LearnerViewPage).
export default function LearnerForm() {
  const { register, control, formState: { errors } } = useFormContext();

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
        <div style={S.row}>
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
          <div style={S.field}>
            <label style={S.label}>Date of Birth</label>
            <input {...register("dateOfBirth")} type="date" style={S.input} />
            {errors.dateOfBirth && <span style={S.error}>{errors.dateOfBirth.message}</span>}
          </div>
        </div>
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Nationality</label>
            <input {...register("nationality")} placeholder="e.g. Kenyan" style={S.input} />
            {errors.nationality && <span style={S.error}>{errors.nationality.message}</span>}
          </div>
          <div style={S.field}>
            <label style={S.label}>Languages</label>
            <input {...register("languages")} placeholder="e.g. English, Kiswahili" style={S.input} />
            {errors.languages && <span style={S.error}>{errors.languages.message}</span>}
          </div>
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
        <GuardianPasswordField />
      </div>
    </div>
  );
}
