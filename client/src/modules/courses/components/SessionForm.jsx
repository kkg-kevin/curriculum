import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Input, SectionHeader, ListField } from "./formFields";
import RichTextEditor from "./RichTextEditor";
import ResourcesField from "./ResourcesField";
import { useAssessmentsQuery } from "../../assessments/hooks/useAssessment";
import { NOTE_QUICK_PICKS } from "../sectionConfig";

const cardStyle = { backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" };

const ASM_TYPE_LABELS = { quiz: "Quiz", exam: "Exam", assignment: "Assignment", project: "Project", observation: "Teacher Observation" };
const ASM_TYPE_COLORS = { quiz: "#25476a", exam: "#38aae1", assignment: "#059669", project: "#7C3AED", observation: "#D97706" };

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

// Shared by Main Concepts, Activity, and Notes — all three are a repeatable list of
// {id, title, content} blocks with a custom heading per block, not a fixed pair of fields. Notes
// additionally offers quick-pick heading presets (Ice Breaker / Wrap Activity) since those used to
// be dedicated fields — clicking one just fills the heading; still freely editable after.
// Renders its own section header (title/subtitle) rather than the caller wrapping a separate card
// around it — a header-only card with no content of its own reads as an empty, broken section.
function RepeatableContentField({ name, title, subtitle, singular, size, quickPicks }) {
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
      <SectionHeader title={title} subtitle={subtitle} />
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
            {quickPicks && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {quickPicks.map((pick) => (
                  <button
                    key={pick}
                    type="button"
                    onClick={() => setValue(`${name}.${idx}.title`, pick, { shouldDirty: true })}
                    style={{
                      padding: "5px 12px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "600",
                      fontFamily: "Inter, sans-serif", cursor: "pointer",
                      backgroundColor: item.title === pick ? "#25476a" : "#e8f5fb",
                      color: item.title === pick ? "#fff" : "#25476a",
                      border: `1.5px solid ${item.title === pick ? "#25476a" : "#a8d5ee"}`,
                    }}
                  >
                    {pick}
                  </button>
                ))}
              </div>
            )}
            <Input name={`${name}.${idx}.title`} label="Heading" placeholder={`e.g. ${singular} name`} hint="Name this card however fits the content" />
            <RichTextEditor name={`${name}.${idx}.content`} label="Content" size={size} />
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

function ModuleField({ modules }) {
  const { watch, setValue } = useFormContext();
  const moduleId = watch("moduleId");

  if (!modules || modules.length === 0) return null;

  return (
    <div style={{ marginTop: "14px" }}>
      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Module</label>
      <select
        value={moduleId || ""}
        onChange={(e) => setValue("moduleId", e.target.value, { shouldDirty: true })}
        style={selectStyle}
      >
        {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </div>
  );
}

export default function SessionForm({ modules }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={cardStyle}>
        <SectionHeader title="Session Details" />
        <Input name="title" label="Session Title" placeholder="e.g. Introduction to Educational Robotics" />
        <ModuleField modules={modules} />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Learning Outcomes" />
        <ListField name="outcomes" label="Outcomes" hint="What will learners be able to do by the end of this session?" placeholder="e.g. Understand the session fundamentals" />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Introduction" />
        <RichTextEditor name="introduction" label="Introduction" />
      </div>

      <RepeatableContentField
        name="mainConcepts" singular="Main Concept" size="lg"
        title="Main Concepts" subtitle="Add as many concept blocks as this session needs — each with its own heading."
      />

      <RepeatableContentField
        name="activities" singular="Activity" size="lg"
        title="Activity" subtitle="Add as many activities as this session needs — each with its own heading."
      />

      <div style={cardStyle}>
        <SectionHeader title="Assessments" subtitle="Attach existing quizzes, assignments, projects, or teacher observations to this session." />
        <AssessmentsField />
      </div>

      <RepeatableContentField
        name="notes" singular="Note" size="lg" quickPicks={NOTE_QUICK_PICKS}
        title="Notes" subtitle="Add as many notes as this session needs — including Ice Breaker and Wrap Activity content — each with its own heading."
      />

      <div style={cardStyle}>
        <SectionHeader title="Resources" />
        <ResourcesField name="resources" label="Attached resources" hint="Documents, images, audio, video, ZIP files, or external links." />
      </div>
    </div>
  );
}
