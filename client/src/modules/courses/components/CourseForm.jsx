import { useState } from "react";
import { useFormContext } from "react-hook-form";
import RichTextEditor from "./RichTextEditor";

function Field({ label, error, required, children, hint }) {
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

function fieldError(errors, name) {
  return name.split(".").reduce((obj, k) => obj?.[k], errors)?.message;
}

function Input({ name, placeholder, label, required, hint, ...rest }) {
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

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{title}</h3>
      {subtitle && <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>{subtitle}</p>}
    </div>
  );
}

/* ── Outcomes: simple add/remove list bound to RHF state ─────────────── */

function OutcomesField() {
  const { watch, setValue, formState: { errors } } = useFormContext();
  const outcomes = watch("outcomes") || [];
  const [input, setInput] = useState("");
  const error = fieldError(errors, "outcomes");

  const addOutcome = () => {
    const value = input.trim();
    if (!value) return;
    setValue("outcomes", [...outcomes, value], { shouldDirty: true });
    setInput("");
  };

  const removeOutcome = (idx) => {
    setValue("outcomes", outcomes.filter((_, i) => i !== idx), { shouldDirty: true });
  };

  return (
    <Field label="Outcomes" error={error} hint="What will learners be able to do by the end of this course?">
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOutcome(); } }}
          placeholder="e.g. Write and run a simple Python script"
          style={{
            flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #E5E7EB",
            fontSize: "14px", fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151",
            outline: "none", boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={addOutcome}
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

      {outcomes.length > 0 && (
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
          {outcomes.map((outcome, idx) => (
            <li
              key={idx}
              style={{
                display: "flex", alignItems: "flex-start", gap: "8px", padding: "8px 12px",
                backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "8px",
              }}
            >
              <span style={{ color: "#38aae1", fontSize: "13px", lineHeight: "1.5", flexShrink: 0 }}>●</span>
              <span style={{ flex: 1, fontSize: "13px", color: "#374151", lineHeight: "1.5" }}>{outcome}</span>
              <button
                type="button"
                onClick={() => removeOutcome(idx)}
                title="Remove outcome"
                style={{
                  background: "none", border: "none", color: "#9CA3AF", cursor: "pointer",
                  fontSize: "16px", lineHeight: 1, padding: 0, flexShrink: 0,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}

export default function CourseForm() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Course Details */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Course Details" />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input name="name" label="Course Name" placeholder="e.g. Introduction to Python" required />
          <RichTextEditor name="description" label="Description" />
        </div>
      </div>

      {/* Outcomes */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Outcomes" />
        <OutcomesField />
      </div>

      {/* Introduction */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Introduction" subtitle="How the lesson opens and how learners are eased into it." />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <RichTextEditor name="introduction.overview" label="Introduction" />
          <RichTextEditor name="introduction.iceBreaker" label="Ice Breaker" />
        </div>
      </div>

      {/* Main Concept */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Main Concept" subtitle="The core content being taught." />
        <RichTextEditor name="mainConcept" label="Main Concept" />
      </div>

      {/* Activities */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Activities" subtitle="What learners will do during and to close the session." />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <RichTextEditor name="activities.classActivity" label="Class Activity" />
          <RichTextEditor name="activities.wrapActivity" label="Wrap Activity" />
        </div>
      </div>

      {/* Teacher's Note */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Teacher's Note" subtitle="Guidance, tips, or reminders for whoever teaches this course." />
        <RichTextEditor name="teachersNote" label="Teacher's Note" />
      </div>
    </div>
  );
}
