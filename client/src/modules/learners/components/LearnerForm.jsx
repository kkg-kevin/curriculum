import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import ImageUploadField from "../../../components/ImageUploadField";
import MultiSelectChips from "../../../components/MultiSelectChips";
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

// Sets up (or resets) the LEARNER's OWN separate portal login, keyed by their username instead
// of the guardian's email — a genuinely different credential from GuardianPasswordField above,
// not another way into the same account. Requires a username to be set.
function LearnerPasswordField() {
  const { register, formState: { errors } } = useFormContext();
  const [show, setShow] = useState(false);
  const error = errors?.learnerPassword?.message;

  return (
    <div style={S.field}>
      <label style={S.label}>Learner Portal Password</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          {...register("learnerPassword")}
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
      {error ? <span style={S.error}>{error}</span> : <span style={S.hint}>Optional — sets up or resets the learner's OWN separate login (not the guardian's). Requires a username. Leave blank to make no change.</span>}
    </div>
  );
}

// A learner is an independent identity, same as a teacher — no school/class field lives here.
// Enrollment (which hub, which class, admission number, status) is managed separately, per
// hub, from the learner's own detail page (see the "Learning Hubs" section on LearnerViewPage).
export default function LearnerForm() {
  const { register, control, watch, formState: { errors } } = useFormContext();
  const age = computeAge(watch("dateOfBirth"));

  return (
    <div style={S.form}>
      <div style={S.section}>
        <p style={S.heading}>Personal Information</p>
        <hr style={S.divider} />
        <div style={S.field}>
          <label style={S.label}>Photo</label>
          <Controller
            name="photo"
            control={control}
            render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} width="140px" height="140px" />}
          />
        </div>
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
            {errors.dateOfBirth
              ? <span style={S.error}>{errors.dateOfBirth.message}</span>
              : age !== null && <span style={S.hint}>Age: {age} year{age !== 1 ? "s" : ""}</span>}
          </div>
        </div>
        <div style={S.field}>
          <label style={S.label}>Nationality</label>
          <select {...register("nationality")} style={S.select}>
            <option value="">— Select nationality —</option>
            {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {errors.nationality && <span style={S.error}>{errors.nationality.message}</span>}
        </div>
        <div style={S.field}>
          <label style={S.label}>Languages</label>
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
          {errors.languages && <span style={S.error}>{errors.languages.message}</span>}
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

      <div style={S.section}>
        <p style={S.heading}>Learner Portal Login</p>
        <hr style={S.divider} />
        <div style={S.field}>
          <label style={S.label}>Student Username</label>
          <input {...register("username")} placeholder="e.g. grace.wambui" style={S.input} />
          {errors.username
            ? <span style={S.error}>{errors.username.message}</span>
            : <span style={S.hint}>Optional — lets the learner log in with a username. Without their own password below, it logs into the guardian's account above; with one, it's their own separate login.</span>}
        </div>
        <LearnerPasswordField />
      </div>
    </div>
  );
}
