import { Input, Textarea, SwitchField, SectionHeader, ListField } from "./formFields";
import CoverImageField from "./CoverImageField";

export default function ProjectForm() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Project Details" />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input name="name" label="Name" placeholder="e.g. Intro to Robotics" required />
          <Textarea name="description" label="Description" placeholder="Describe the project…" required />
          <CoverImageField name="coverImage" label="Cover Image" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            <Input name="ageMin" label="Min Age" type="number" min="0" max="25" placeholder="e.g. 8" />
            <Input name="ageMax" label="Max Age" type="number" min="0" max="25" placeholder="e.g. 14" />
            <Input name="sessionCount" label="Session Count" type="number" min="0" placeholder="e.g. 10" />
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Requirements" subtitle="Freeform requirements shown on the public detail page." />
        <ListField name="requirements" label="Requirements" hint="Press Enter or Add after each one." placeholder="e.g. Internet access" />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Modules" subtitle="Module names shown on the project's public detail page." />
        <ListField name="modules" label="Modules" hint="Press Enter or Add after each one." placeholder="e.g. Getting Started" />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Publishing" />
        <SwitchField name="isPublished" label="Published" hint="Only published projects are visible on the public site." />
      </div>
    </div>
  );
}
