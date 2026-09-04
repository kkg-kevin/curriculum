import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Field, fieldError } from "./formFields";

// Repeatable name+slug pair input for Bootcamp.courses: [{ name, slug }] — a minor field per
// the public-site.validation.js shape, so a simple two-box add/remove row is enough (no need
// for the full CoursePickerField machinery courses/ uses for its own linked-courses UI).
export default function CoursePairsField({ name, label, hint }) {
  const { watch, setValue, formState: { errors } } = useFormContext();
  const items = watch(name) || [];
  const [draftName, setDraftName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const error = fieldError(errors, name);

  const addItem = () => {
    const trimmedName = draftName.trim();
    const trimmedSlug = draftSlug.trim();
    if (!trimmedName || !trimmedSlug) return;
    setValue(name, [...items, { name: trimmedName, slug: trimmedSlug }], { shouldDirty: true });
    setDraftName("");
    setDraftSlug("");
  };

  const removeItem = (idx) => {
    setValue(name, items.filter((_, i) => i !== idx), { shouldDirty: true });
  };

  const rowInputStyle = {
    flex: 1, padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB",
    fontSize: "13px", fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <Field label={label} error={error} hint={hint}>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder="Course name"
          style={rowInputStyle}
        />
        <input
          value={draftSlug}
          onChange={(e) => setDraftSlug(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder="course-slug"
          style={rowInputStyle}
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!draftName.trim() || !draftSlug.trim()}
          style={{
            padding: "0 18px", borderRadius: "9px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff",
            color: "#25476a", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif",
            cursor: draftName.trim() && draftSlug.trim() ? "pointer" : "not-allowed",
            opacity: draftName.trim() && draftSlug.trim() ? 1 : 0.5, flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px",
                backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "8px",
              }}
            >
              <span style={{ flex: 1, fontSize: "13px", color: "#374151", fontWeight: "600" }}>{item.name}</span>
              <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{item.slug}</span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                title="Remove"
                style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0, flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Field>
  );
}
