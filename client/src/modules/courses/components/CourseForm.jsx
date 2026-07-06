import { Input, SectionHeader, AgeRangeField } from "./formFields";
import RichTextEditor from "./RichTextEditor";
import CoverImageField from "./CoverImageField";
import CompetenciesField from "./CompetenciesField";
import LearningAreasField from "./LearningAreasField";

export default function CourseForm() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Course Details" />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input name="name" label="Course Name" placeholder="e.g. Code for Educators - Robotics" required />
          <AgeRangeField minName="ageMin" maxName="ageMax" label="Age Range" hint="The age group this course is designed for" />
          <RichTextEditor name="description" label="Description" />
          <CoverImageField name="coverImage" label="Cover Image" />
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Competencies" subtitle="Tag which competencies this course builds toward." />
        <CompetenciesField name="competencyIds" hint="Pick from the shared catalog defined in Settings." />
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Learning Areas" subtitle="Tag which learning areas this course falls under." />
        <LearningAreasField name="learningAreaIds" hint="Pick from the shared catalog defined in Settings." />
      </div>
    </div>
  );
}
