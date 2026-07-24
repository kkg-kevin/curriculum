import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
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

export default function EditProfileModal({ learner, isSaving, onSave, onClose }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    nationality: "",
    languages: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (learner) {
      setFormData({
        firstName: learner.firstName || "",
        lastName: learner.lastName || "",
        gender: learner.gender || "",
        dateOfBirth: learner.dateOfBirth || "",
        nationality: learner.nationality || "",
        languages: learner.languages || "",
        guardianName: learner.guardianName || "",
        guardianPhone: learner.guardianPhone || "",
        guardianEmail: learner.guardianEmail || "",
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
    if (!formData.guardianName.trim()) nextErrors.guardianName = "Guardian name is required";
    if (!formData.guardianPhone.trim()) nextErrors.guardianPhone = "Guardian phone is required";
    if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
      nextErrors.guardianEmail = "Enter a valid email";
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
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.ink }}>Edit profile</h2>
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
              <input name="nationality" value={formData.nationality} onChange={handleChange} placeholder="e.g. Kenyan" style={inputStyle(false)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Languages</label>
            <input name="languages" value={formData.languages} onChange={handleChange} placeholder="e.g. English, Kiswahili" style={inputStyle(false)} />
          </div>

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
