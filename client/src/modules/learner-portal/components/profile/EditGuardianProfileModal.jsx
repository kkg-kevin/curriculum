import { useEffect, useState } from "react";
import { FiX, FiEye, FiEyeOff } from "react-icons/fi";
import { T } from "./theme";

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

// The GUARDIAN's own contact profile + own portal password — separate from EditProfileModal
// (the learner's own identity) now that the learner can have their own dedicated login. Saving
// here never touches firstName/lastName/nationality/etc. or the learner's own learnerPassword —
// they simply aren't part of this form's payload.
export default function EditGuardianProfileModal({ learner, isSaving, onSave, onClose }) {
  const [formData, setFormData] = useState({
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (learner) {
      setFormData({
        guardianName: learner.guardianName || "",
        guardianPhone: learner.guardianPhone || "",
        guardianEmail: learner.guardianEmail || "",
        password: "",
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
    if (!formData.guardianName.trim()) nextErrors.guardianName = "Guardian name is required";
    if (!formData.guardianPhone.trim()) nextErrors.guardianPhone = "Guardian phone is required";
    if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
      nextErrors.guardianEmail = "Enter a valid email";
    }
    if (formData.password) {
      if (formData.password.length < 8) nextErrors.password = "Must be at least 8 characters";
      if (!formData.guardianEmail.trim()) nextErrors.guardianEmail = "Guardian email is required to set a password";
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
          backgroundColor: "#fff", borderRadius: 20, width: "100%", maxWidth: 480,
          maxHeight: "90vh", overflowY: "auto", fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.ink }}>Edit Guardian Profile</h2>
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
            <label style={labelStyle}>Guardian name</label>
            <input name="guardianName" value={formData.guardianName} onChange={handleChange} style={inputStyle(errors.guardianName)} />
            {errors.guardianName && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.guardianName}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={labelStyle}>Guardian phone</label>
              <input name="guardianPhone" value={formData.guardianPhone} onChange={handleChange} style={inputStyle(errors.guardianPhone)} />
              {errors.guardianPhone && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.guardianPhone}</p>}
            </div>
            <div>
              <label style={labelStyle}>Guardian email</label>
              <input name="guardianEmail" type="email" value={formData.guardianEmail} onChange={handleChange} style={inputStyle(errors.guardianEmail)} />
              {errors.guardianEmail && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.guardianEmail}</p>}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Guardian Portal Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                style={{ ...inputStyle(errors.password), paddingRight: 40 }}
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
            {errors.password
              ? <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.password}</p>
              : <p style={{ margin: "6px 0 0", fontSize: 12, color: T.inkMuted }}>Optional — resets your own guardian portal password. Leave blank to make no change.</p>}
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
