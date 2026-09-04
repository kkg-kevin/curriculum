import { useState } from "react";
import { useFormContext } from "react-hook-form";

// Same house style as modules/courses/components/formFields.jsx — kept as its own copy here
// rather than a cross-module import, since the codebase has no shared code between modules.

export function Field({ label, error, required, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      {label && (
        <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "flex", alignItems: "center", gap: "3px" }}>
          {label}
          {required && <span style={{ color: "#EF4444" }}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{hint}</p>}
      {error && <p style={{ margin: 0, fontSize: "12px", color: "#EF4444" }}>{error}</p>}
    </div>
  );
}

export function fieldError(errors, name) {
  return name.split(".").reduce((obj, k) => obj?.[k], errors)?.message;
}

const baseInputStyle = (error) => ({
  padding: "10px 12px",
  borderRadius: "10px",
  border: `1.5px solid ${error ? "#FCA5A5" : "#E5E7EB"}`,
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: error ? "#FFF5F5" : "#F9FAFB",
  color: "#374151",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
});

export function Input({ name, placeholder, label, required, hint, ...rest }) {
  const { register, formState: { errors } } = useFormContext();
  const error = fieldError(errors, name);

  return (
    <Field label={label} error={error} required={required} hint={hint}>
      <input
        placeholder={placeholder}
        {...register(name)}
        {...rest}
        style={baseInputStyle(error)}
        onFocus={(e) => { e.target.style.borderColor = "#b8d9ee"; e.target.style.backgroundColor = "#fff"; }}
        onBlur={(e) => { e.target.style.borderColor = error ? "#FCA5A5" : "#E5E7EB"; e.target.style.backgroundColor = error ? "#FFF5F5" : "#F9FAFB"; }}
      />
    </Field>
  );
}

export function Textarea({ name, placeholder, label, required, hint, rows = 5 }) {
  const { register, formState: { errors } } = useFormContext();
  const error = fieldError(errors, name);

  return (
    <Field label={label} error={error} required={required} hint={hint}>
      <textarea
        placeholder={placeholder}
        rows={rows}
        {...register(name)}
        style={{ ...baseInputStyle(error), resize: "vertical", fontFamily: "Inter, sans-serif" }}
        onFocus={(e) => { e.target.style.borderColor = "#b8d9ee"; e.target.style.backgroundColor = "#fff"; }}
        onBlur={(e) => { e.target.style.borderColor = error ? "#FCA5A5" : "#E5E7EB"; e.target.style.backgroundColor = error ? "#FFF5F5" : "#F9FAFB"; }}
      />
    </Field>
  );
}

export const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1.5px solid #E5E7EB",
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: "#F9FAFB",
  color: "#374151",
  outline: "none",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  cursor: "pointer",
};

export function Select({ name, label, hint, children }) {
  const { register } = useFormContext();
  return (
    <Field label={label} hint={hint}>
      <select {...register(name)} style={selectStyle}>
        {children}
      </select>
    </Field>
  );
}

export function SwitchField({ name, label, hint }) {
  const { watch, setValue } = useFormContext();
  const checked = !!watch(name);

  return (
    <Field hint={hint}>
      <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", width: "fit-content" }}>
        <span
          role="switch"
          aria-checked={checked}
          onClick={() => setValue(name, !checked, { shouldDirty: true })}
          style={{
            width: "38px", height: "22px", borderRadius: "999px", flexShrink: 0, position: "relative",
            backgroundColor: checked ? "#25476a" : "#E5E7EB", transition: "background-color 0.15s", cursor: "pointer",
          }}
        >
          <span
            style={{
              position: "absolute", top: "2px", left: checked ? "18px" : "2px", width: "18px", height: "18px",
              borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </span>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{label}</span>
      </label>
    </Field>
  );
}

export function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{title}</h3>
      {subtitle && <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>{subtitle}</p>}
    </div>
  );
}

/* ── ListField: generic add/remove list of plain strings bound to RHF state (used for
   Bootcamp.classes, Project.requirements, Project.modules — simple tag-style string arrays) ── */

export function ListField({ name, label, hint, placeholder }) {
  const { watch, setValue, formState: { errors } } = useFormContext();
  const items = watch(name) || [];
  const [input, setInput] = useState("");
  const error = fieldError(errors, name);

  const addItem = () => {
    const value = input.trim();
    if (!value) return;
    setValue(name, [...items, value], { shouldDirty: true });
    setInput("");
  };

  const removeItem = (idx) => {
    setValue(name, items.filter((_, i) => i !== idx), { shouldDirty: true });
  };

  return (
    <Field label={label} error={error} hint={hint}>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder={placeholder}
          style={{
            flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #E5E7EB",
            fontSize: "14px", fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151",
            outline: "none", boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!input.trim()}
          style={{
            padding: "0 18px", borderRadius: "10px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff",
            color: "#25476a", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif",
            cursor: input.trim() ? "pointer" : "not-allowed", opacity: input.trim() ? 1 : 0.5, flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
          {items.map((item, idx) => (
            <span
              key={idx}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 10px 5px 12px",
                backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "20px",
                fontSize: "12.5px", color: "#374151",
              }}
            >
              {item}
              <button
                type="button"
                onClick={() => removeItem(idx)}
                title="Remove"
                style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "15px", lineHeight: 1, padding: 0, display: "flex" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}
