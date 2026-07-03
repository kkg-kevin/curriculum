import { useFormContext } from "react-hook-form";
import { ASSESSMENT_TYPES } from "../schemas/assessment.schema";
import RichTextEditor from "../../courses/components/RichTextEditor";

const selectStyle = {
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

function Input({ name, placeholder, label, required, hint, ...rest }) {
  const { register, formState: { errors } } = useFormContext();
  const error = errors?.[name]?.message;

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

function Textarea({ name, placeholder, label, hint }) {
  const { register, formState: { errors } } = useFormContext();
  const error = errors?.[name]?.message;

  return (
    <Field label={label} error={error} hint={hint}>
      <textarea
        placeholder={placeholder}
        rows={4}
        {...register(name)}
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
          resize: "vertical",
        }}
      />
    </Field>
  );
}

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", project: "Project", assignment: "Assignment" };

export default function AssessmentForm() {
  const { register, formState: { errors } } = useFormContext();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
            Assessment Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input name="name" label="Assessment Name" placeholder="e.g. Mid-term Mathematics Exam" required />
            <Textarea name="description" label="Description" placeholder="What does this assessment cover?" />
            <Field label="Type" required error={errors?.type?.message}>
              <select {...register("type")} style={selectStyle}>
                <option value="">Select type…</option>
                {ASSESSMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
            Content
          </h3>
          <RichTextEditor name="instructions" label="Content" hint="Shown to learners when they open this assessment — add text and images" />
        </div>
      </div>
    </div>
  );
}
