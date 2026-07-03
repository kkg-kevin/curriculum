import { Input, SectionHeader } from "./formFields";
import RichTextEditor from "./RichTextEditor";
import CoverImageField from "./CoverImageField";
import CompetenciesField from "./CompetenciesField";

export default function CourseForm() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Course Details" />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input name="name" label="Course Name" placeholder="e.g. Code for Educators - Robotics" required />
          <RichTextEditor name="description" label="Description" />
          <CoverImageField name="coverImage" label="Cover Image" />
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Competencies" subtitle="Tag which competencies this course builds toward." />
        <CompetenciesField name="competencyIds" label="Competencies" hint="Pick from the shared catalog defined in Settings." />
      </div>
    </div>
  );
}
