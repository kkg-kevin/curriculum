import { useState } from "react";
import { useFormContext } from "react-hook-form";

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
});

// Reusable "set or reset a portal password" field for any entity's create/edit form (teacher,
// learner's guardian, learner's own login) — same field shape, show/hide toggle, and "leave
// blank to make no change" semantics everywhere, just a different registered field name/label/
// hint per caller. Extracted so per-form copies of this (previously duplicated in TeacherForm
// and LearnerForm, each styled slightly differently) can't drift out of visual sync again.
export default function PortalPasswordField({ name, label, hint }) {
  const { register, formState: { errors } } = useFormContext();
  const [show, setShow] = useState(false);
  const error = errors?.[name]?.message;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          {...register(name)}
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
      {error
        ? <p style={{ margin: 0, fontSize: "12px", color: "#EF4444" }}>{error}</p>
        : <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{hint}</p>}
    </div>
  );
}
