import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Input, Field, SectionHeader, AgeRangeField } from "./formFields";
import RichTextEditor from "./RichTextEditor";
import CoverImageField from "./CoverImageField";
import LearningAreasField from "./LearningAreasField";
import { generateCourseCode } from "../schemas/course.schema";
import { useCoursesQuery } from "../hooks/useCourse";

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

// The code is pre-filled live from the Name field (see generateCourseCode) so there's a sane
// default without typing anything — but it's a starting point, not a lock: the moment the admin
// edits it directly, that manual value wins and further Name changes stop overwriting it.
function CodeField({ autoGenerate, existingCodes }) {
  const { register, watch, setValue, formState: { errors, dirtyFields } } = useFormContext();
  const name = watch("name");
  const error = errors?.code?.message;

  useEffect(() => {
    if (!autoGenerate || dirtyFields.code) return;
    setValue("code", generateCourseCode(name, existingCodes), { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, name, setValue, dirtyFields.code]);

  return (
    <Field label="Code" error={error} hint="Auto-filled from the course name — edit it if you'd like a different one.">
      <input
        type="text"
        placeholder="e.g. L1CF"
        {...register("code")}
        style={{ padding: "10px 12px", borderRadius: "10px", border: `1.5px solid ${error ? "#FCA5A5" : "#E5E7EB"}`, fontSize: "14px", fontFamily: "Inter, sans-serif", backgroundColor: error ? "#FFF5F5" : "#F9FAFB", color: "#374151", outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color 0.15s" }}
        onFocus={(e) => { e.target.style.borderColor = "#b8d9ee"; e.target.style.backgroundColor = "#fff"; }}
        onBlur={(e) => { e.target.style.borderColor = error ? "#FCA5A5" : "#E5E7EB"; e.target.style.backgroundColor = error ? "#FFF5F5" : "#F9FAFB"; }}
      />
    </Field>
  );
}

function StatusField() {
  const { register } = useFormContext();
  return (
    <Field label="Status" hint="New courses start as Draft — activate when ready to use.">
      <select {...register("status")} style={selectStyle}>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
    </Field>
  );
}

export default function CourseForm({ autoGenerateCode = false }) {
  const { data: allCoursesData } = useCoursesQuery();
  const existingCodes = (allCoursesData?.data || []).map((c) => c.code).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Course Details" />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input name="name" label="Course Name" placeholder="e.g. Code for Educators - Robotics" required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <CodeField autoGenerate={autoGenerateCode} existingCodes={existingCodes} />
            <StatusField />
          </div>
          <AgeRangeField minName="ageMin" maxName="ageMax" label="Age Range" hint="The age group this course is designed for" />
          <RichTextEditor name="description" label="Description" />
          <CoverImageField name="coverImage" label="Cover Image" />
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <SectionHeader title="Learning Areas" subtitle="Tag which learning areas this course falls under." />
        <LearningAreasField name="learningAreaIds" hint="Pick from the shared catalog defined in Settings." />
      </div>
    </div>
  );
}
