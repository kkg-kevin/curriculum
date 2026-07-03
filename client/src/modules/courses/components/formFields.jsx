import { useState } from "react";
import { useFormContext } from "react-hook-form";

export function Field({ label, error, required, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "flex", alignItems: "center", gap: "3px" }}>
        {label}
        {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      {children}
      {hint && !error && <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{hint}</p>}
      {error && <p style={{ margin: 0, fontSize: "12px", color: "#EF4444" }}>{error}</p>}
    </div>
  );
}

export function fieldError(errors, name) {
  return name.split(".").reduce((obj, k) => obj?.[k], errors)?.message;
}

export function Input({ name, placeholder, label, required, hint, ...rest }) {
  const { register, formState: { errors } } = useFormContext();
  const error = fieldError(errors, name);

  return (
    <Field label={label} error={error} required={required} hint={hint}>
      <input
        placeholder={placeholder}
        {...register(name)}
        {...rest}
        style={{
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
        }}
        onFocus={(e) => { e.target.style.borderColor = "#b8d9ee"; e.target.style.backgroundColor = "#fff"; }}
        onBlur={(e) => { e.target.style.borderColor = error ? "#FCA5A5" : "#E5E7EB"; e.target.style.backgroundColor = error ? "#FFF5F5" : "#F9FAFB"; }}
      />
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

/* ── ListField: generic add/remove list of plain strings bound to RHF state ── */

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
        <ol style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" }}>
          {items.map((item, idx) => (
            <li
              key={idx}
              style={{
                display: "flex", alignItems: "flex-start", gap: "8px", padding: "8px 12px",
                backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "8px",
              }}
            >
              <span style={{ color: "#38aae1", fontSize: "13px", fontWeight: "700", lineHeight: "1.5", flexShrink: 0, minWidth: "16px" }}>{idx + 1}.</span>
              <span style={{ flex: 1, fontSize: "13px", color: "#374151", lineHeight: "1.5" }}>{item}</span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                title="Remove"
                style={{
                  background: "none", border: "none", color: "#9CA3AF", cursor: "pointer",
                  fontSize: "16px", lineHeight: 1, padding: 0, flexShrink: 0,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
    </Field>
  );
}
