import { Input, SectionHeader, ListField } from "./formFields";
import RichTextEditor from "./RichTextEditor";
import ResourcesField from "./ResourcesField";

export default function SessionForm() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Session Details" />
        <Input name="title" label="Session Title" placeholder="e.g. Introduction to Educational Robotics" required />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Learning Outcomes" />
        <ListField name="outcomes" label="Outcomes" hint="What will learners be able to do by the end of this session?" placeholder="e.g. Understand the session fundamentals" />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Introduction" />
        <RichTextEditor name="introduction" label="Introduction" />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Main Concepts" />
        <RichTextEditor name="mainConcepts" label="Main Concepts" />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Activities" />
        <RichTextEditor name="activities" label="Activities" />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Notes" />
        <RichTextEditor name="notes" label="Notes" />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Resources" />
        <ResourcesField name="resources" label="Attached documents" hint="PDF, Word, Excel, or PowerPoint files." />
      </div>
    </div>
  );
}
