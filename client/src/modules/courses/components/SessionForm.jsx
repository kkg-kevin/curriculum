import { Input, SectionHeader, ListField } from "./formFields";
import RichTextEditor from "./RichTextEditor";
import ResourcesField from "./ResourcesField";

const cardStyle = { backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" };

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
        <SectionHeader title="Main Concepts — Introduction" />
        <RichTextEditor name="mainConceptsIntro" label="Introduction" />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Main Concepts — Body" />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input name="mainConceptsBodyTitle" label="Heading" placeholder="e.g. Body" hint="Name this card however fits the content" />
          <RichTextEditor name="mainConceptsBody" label="Content" />
        </div>
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Class Activity" />
        <RichTextEditor name="classActivity" label="Class Activity" />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Wrap Activity" />
        <RichTextEditor name="wrapActivity" label="Wrap Activity" />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Teacher's Note" />
        <RichTextEditor name="notes" label="Teacher's Note" />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Resources" />
        <ResourcesField name="resources" label="Attached documents" hint="PDF, Word, Excel, or PowerPoint files." />
      </div>
    </div>
  );
}
