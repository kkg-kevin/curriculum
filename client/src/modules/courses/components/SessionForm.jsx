import { useFormContext } from "react-hook-form";
import { Input, SectionHeader, ListField } from "./formFields";
import RichTextEditor from "./RichTextEditor";
import ResourcesField from "./ResourcesField";

const cardStyle = { backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" };

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
