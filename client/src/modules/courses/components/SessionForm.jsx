import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Input, SectionHeader, ListField } from "./formFields";
import RichTextEditor from "./RichTextEditor";
import ResourcesField from "./ResourcesField";
import { useAssessmentsQuery } from "../../assessments/hooks/useAssessment";

const cardStyle = { backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" };

const ASM_TYPE_LABELS = { quiz: "Quiz", assignment: "Assignment", project: "Project", observation: "Teacher Observation" };
const ASM_TYPE_COLORS = { quiz: "#25476a", assignment: "#059669", project: "#7C3AED", observation: "#D97706" };

const selectStyle = {
  padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #E5E7EB",
  fontSize: "13.5px", fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB",
  color: "#374151", outline: "none", boxSizing: "border-box",
};

// Attaches existing Assessment records (created in the Assessments module) to this session by
// id — the session only stores assessmentIds, never a copy of the assessment content itself.
function AssessmentsField() {
  const { watch, setValue } = useFormContext();
  const assessmentIds = watch("assessmentIds") || [];
  const { data, isLoading } = useAssessmentsQuery();
  const allAssessments = data?.data || [];

  const [type, setType] = useState("quiz");
  const [pickedId, setPickedId] = useState("");

  const availableOfType = allAssessments.filter((a) => a.type === type && !assessmentIds.includes(a.id));
  const attached = assessmentIds.map((id) => allAssessments.find((a) => a.id === id)).filter(Boolean);

  const addAssessment = () => {
    if (!pickedId) return;
    setValue("assessmentIds", [...assessmentIds, pickedId], { shouldDirty: true });
    setPickedId("");
  };

  const removeAssessment = (id) => {
    setValue("assessmentIds", assessmentIds.filter((x) => x !== id), { shouldDirty: true });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <select value={type} onChange={(e) => { setType(e.target.value); setPickedId(""); }} style={selectStyle}>
          {Object.entries(ASM_TYPE_LABELS).map(([t, label]) => <option key={t} value={t}>{label}</option>)}
        </select>
        <select
          value={pickedId}
          onChange={(e) => setPickedId(e.target.value)}
          disabled={isLoading || availableOfType.length === 0}
          style={{ ...selectStyle, flex: 1, minWidth: "220px" }}
        >
          <option value="">
            {isLoading ? "Loading assessments…" : availableOfType.length ? "Select an assessment…" : `No ${ASM_TYPE_LABELS[type].toLowerCase()} assessments available`}
          </option>
          {availableOfType.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button
          type="button"
          onClick={addAssessment}
          disabled={!pickedId}
          style={{
            padding: "0 18px", borderRadius: "10px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff",
            color: "#25476a", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif",
            cursor: pickedId ? "pointer" : "not-allowed", opacity: pickedId ? 1 : 0.5, flexShrink: 0,
          }}
        >
          + Add
        </button>
      </div>

      {attached.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
          {attached.map((a) => {
            const color = ASM_TYPE_COLORS[a.type] || "#9CA3AF";
            return (
              <li key={a.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: "13.5px", fontWeight: "600", color: "#111827" }}>{a.name}</span>
                <span style={{ fontSize: "11px", fontWeight: "700", color, backgroundColor: `${color}15`, border: `1px solid ${color}35`, padding: "2px 9px", borderRadius: "20px", whiteSpace: "nowrap" }}>
                  {ASM_TYPE_LABELS[a.type] || a.type}
                </span>
                <button
                  type="button"
                  onClick={() => removeAssessment(a.id)}
                  title="Remove"
                  style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0, flexShrink: 0 }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>No assessments attached yet.</p>
      )}
    </div>
  );
}

// Shared by Main Concepts and Activities — both are a repeatable list of {id, title, content}
// blocks with a custom heading per block, not a fixed pair of fields.
function RepeatableContentField({ name, singular }) {
  const { watch, setValue } = useFormContext();
  const items = watch(name) || [];

  const addItem = () => {
    setValue(name, [...items, { id: crypto.randomUUID(), title: "", content: "" }], { shouldDirty: true });
  };

  const removeItem = (idx) => {
    setValue(name, items.filter((_, i) => i !== idx), { shouldDirty: true });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {items.map((item, idx) => (
        <div key={item.id} style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{singular} {idx + 1}</h3>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                style={{ background: "none", border: "none", color: "#EF4444", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}
              >
                Remove
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input name={`${name}.${idx}.title`} label="Heading" placeholder={`e.g. ${singular} name`} hint="Name this card however fits the content" />
            <RichTextEditor name={`${name}.${idx}.content`} label="Content" />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px", alignSelf: "flex-start",
          padding: "10px 18px", backgroundColor: "#e8f5fb", color: "#25476a",
          border: "1.5px dashed #a8d5ee", borderRadius: "10px", fontSize: "13px", fontWeight: "700",
          fontFamily: "Inter, sans-serif", cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "15px", lineHeight: 1 }}>+</span> Add {singular}
      </button>
    </div>
  );
}

// Activities is a repeatable list too, but each unit is one Activity holding two fixed
// sub-parts (Class Activity + Wrap Activity) rather than a single content field.
function ActivitiesField() {
  const { watch, setValue } = useFormContext();
  const items = watch("activities") || [];

  const addItem = () => {
    setValue("activities", [...items, { id: crypto.randomUUID(), title: "", classActivity: "", wrapActivity: "" }], { shouldDirty: true });
  };

  const removeItem = (idx) => {
    setValue("activities", items.filter((_, i) => i !== idx), { shouldDirty: true });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {items.map((item, idx) => (
        <div key={item.id} style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Activity {idx + 1}</h3>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                style={{ background: "none", border: "none", color: "#EF4444", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}
              >
                Remove
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input name={`activities.${idx}.title`} label="Heading" placeholder="e.g. Robot Walk Activity" hint="Name this activity however fits the content" />
            <RichTextEditor name={`activities.${idx}.classActivity`} label="Class Activity" />
            <RichTextEditor name={`activities.${idx}.wrapActivity`} label="Wrap Activity" />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px", alignSelf: "flex-start",
          padding: "10px 18px", backgroundColor: "#e8f5fb", color: "#25476a",
          border: "1.5px dashed #a8d5ee", borderRadius: "10px", fontSize: "13px", fontWeight: "700",
          fontFamily: "Inter, sans-serif", cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "15px", lineHeight: 1 }}>+</span> Add Activity
      </button>
    </div>
  );
}

export default function SessionForm() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={cardStyle}>
        <SectionHeader title="Session Details" />
        <Input name="title" label="Session Title" placeholder="e.g. Introduction to Educational Robotics" />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Learning Outcomes" />
        <ListField name="outcomes" label="Outcomes" hint="What will learners be able to do by the end of this session?" placeholder="e.g. Understand the session fundamentals" />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Introduction" />
        <RichTextEditor name="introduction" label="Introduction" />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Ice Breaker" />
        <RichTextEditor name="iceBreaker" label="Ice Breaker" />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Main Concepts" subtitle="Add as many concept blocks as this session needs — each with its own heading." />
      </div>
      <RepeatableContentField name="mainConcepts" singular="Main Concept" />

      <div style={cardStyle}>
        <SectionHeader title="Activities" subtitle="Add as many activities as this session needs — each has a Class Activity and Wrap Activity." />
      </div>
      <ActivitiesField />

      <div style={cardStyle}>
        <SectionHeader title="Assessments" subtitle="Attach existing quizzes, assignments, projects, or teacher observations to this session." />
        <AssessmentsField />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Teacher's Guide" subtitle="Add as many notes as this session needs — each with its own heading." />
      </div>
      <RepeatableContentField name="notes" singular="Note" />

      <div style={cardStyle}>
        <SectionHeader title="Resources" />
        <ResourcesField name="resources" label="Attached documents" hint="PDF, Word, Excel, or PowerPoint files." />
      </div>
    </div>
  );
}
