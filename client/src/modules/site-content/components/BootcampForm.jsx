import { Input, Textarea, Select, SwitchField, SectionHeader, ListField } from "./formFields";
import CoverImageField from "./CoverImageField";
import CoursePairsField from "./CoursePairsField";

export default function BootcampForm() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Bootcamp Details" />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input name="name" label="Name" placeholder="e.g. Junior Robotics Bootcamp" required />
          <Textarea name="description" label="Description" placeholder="Describe the bootcamp…" required />
          <CoverImageField name="coverImage" label="Cover Image" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            <Select name="status" label="Status">
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </Select>
            <Input name="startDate" label="Start Date" type="date" />
            <Input name="endDate" label="End Date" type="date" />
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Grade / Level" subtitle="Who this bootcamp is aimed at — freeform text, shown as-authored on the public site." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
          <Input name="educationLevel" label="Education Level" placeholder="e.g. Primary" />
          <Input name="gradeFrom" label="Grade From" placeholder="e.g. Grade 4" />
          <Input name="gradeTo" label="Grade To" placeholder="e.g. Grade 6" />
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Classes" subtitle="Cohort/class labels shown on the bootcamp's public detail page." />
        <ListField name="classes" label="Classes" hint="Press Enter or Add after each one." placeholder="e.g. Weekday Class A" />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Courses" subtitle="Courses/projects covered in this bootcamp, linked by name and slug." />
        <CoursePairsField name="courses" label="Courses" hint="Enter both a name and a slug, then Add." />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Publishing" />
        <SwitchField name="isPublished" label="Published" hint="Only published bootcamps are visible on the public site." />
      </div>
    </div>
  );
}
