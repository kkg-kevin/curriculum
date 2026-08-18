import { useEffect, useState } from "react";
import { FiX, FiEye, FiEyeOff } from "react-icons/fi";
import { T } from "./theme";
import ImageUploadField from "../../../../components/ImageUploadField";
import MultiSelectChips from "../../../../components/MultiSelectChips";
import { NATIONALITIES, LANGUAGES } from "../../../learners/schemas/learner.schema";

const inputStyle = (hasError) => ({
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${hasError ? "#ef4444" : T.border}`,
  fontSize: 14,
  fontFamily: "Inter, sans-serif",
  boxSizing: "border-box",
});

const labelStyle = { display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: T.ink };

// The LEARNER's own identity — separate from EditGuardianProfileModal now that the learner can
// have their own dedicated login distinct from the guardian's (see auth.service.js's
// setOrCreatePasswordByUsername). Saving here never touches guardianName/guardianPhone/
// guardianEmail/the guardian's own password — they simply aren't part of this form's payload,
// and the server's partial-update filter only ever touches keys actually present in the body.
export default function EditProfileModal({ learner, isSaving, onSave, onClose }) {
  const [formData, setFormData] = useState({
    photo: null,
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    nationality: "",
    languages: "",
    username: "",
    learnerPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (learner) {
      setFormData({
        photo: learner.photo || null,
        firstName: learner.firstName || "",
        lastName: learner.lastName || "",
        gender: learner.gender || "",
        dateOfBirth: learner.dateOfBirth || "",
        nationality: learner.nationality || "",
        languages: learner.languages || "",
        username: learner.username || "",
        learnerPassword: "",
      });
    }
  }, [learner]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = {};
    if (!formData.firstName.trim()) nextErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) nextErrors.lastName = "Last name is required";
    if (!formData.gender) nextErrors.gender = "Gender is required";
    if (formData.username && !/^[a-zA-Z0-9._-]{3,30}$/.test(formData.username)) {
      nextErrors.username = "3-30 characters — letters, numbers, dots, underscores, and hyphens only";
    }
    if (formData.learnerPassword) {
      if (formData.learnerPassword.length < 8) nextErrors.learnerPassword = "Must be at least 8 characters";
      if (!formData.username.trim()) nextErrors.username = "Username is required to set a learner-portal password";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    onSave(formData);
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(17,24,39,0.5)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff", borderRadius: 20, width: "100%", maxWidth: 560,
          maxHeight: "90vh", overflowY: "auto", fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.ink }}>Edit Learner Profile</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: T.inkMuted, padding: 6, display: "flex" }}
          >
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Photo</label>
            <ImageUploadField
              value={formData.photo}
              onChange={(url) => setFormData((prev) => ({ ...prev, photo: url }))}
              width="140px"
              height="140px"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={labelStyle}>First name</label>
              <input name="firstName" value={formData.firstName} onChange={handleChange} style={inputStyle(errors.firstName)} />
              {errors.firstName && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.firstName}</p>}
            </div>
            <div>
              <label style={labelStyle}>Last name</label>
              <input name="lastName" value={formData.lastName} onChange={handleChange} style={inputStyle(errors.lastName)} />
              {errors.lastName && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Gender</label>
            <select name="gender" value={formData.gender} onChange={handleChange} style={{ ...inputStyle(errors.gender), backgroundColor: "#fff" }}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {errors.gender && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.gender}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={labelStyle}>Date of birth</label>
              <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} style={inputStyle(false)} />
            </div>
            <div>
              <label style={labelStyle}>Nationality</label>
              <select name="nationality" value={formData.nationality} onChange={handleChange} style={{ ...inputStyle(false), backgroundColor: "#fff" }}>
                <option value="">— Select nationality —</option>
                {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Languages</label>
            <MultiSelectChips
              options={LANGUAGES}
              value={formData.languages ? formData.languages.split(",").map((v) => v.trim()).filter(Boolean) : []}
              onChange={(next) => setFormData((prev) => ({ ...prev, languages: next.join(", ") }))}
              itemLabel="languages"
            />
          </div>

          <div>
            <label style={labelStyle}>Student username</label>
            <input name="username" value={formData.username} onChange={handleChange} placeholder="e.g. grace.wambui" style={inputStyle(errors.username)} />
            {errors.username
              ? <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.username}</p>
              : <p style={{ margin: "6px 0 0", fontSize: 12, color: T.inkMuted }}>Optional — a login name. Without a learner-portal password below, it logs into the guardian's account; with one, it's a separate login.</p>}
          </div>

          <div>
            <label style={labelStyle}>Learner Portal Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                name="learnerPassword"
                autoComplete="new-password"
                value={formData.learnerPassword}
                onChange={handleChange}
                placeholder="At least 8 characters"
                style={{ ...inputStyle(errors.learnerPassword), paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.inkMuted, cursor: "pointer", display: "flex" }}
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            {errors.learnerPassword
              ? <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.learnerPassword}</p>
              : <p style={{ margin: "6px 0 0", fontSize: 12, color: T.inkMuted }}>Optional — sets up or resets this learner's OWN separate login (not the guardian's). Leave blank to make no change.</p>}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "10px 18px", backgroundColor: "transparent", color: T.inkMuted, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{ padding: "10px 18px", backgroundColor: isSaving ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif" }}
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
