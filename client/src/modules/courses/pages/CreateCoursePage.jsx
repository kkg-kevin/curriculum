import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCourse, useCreateSessionsBulk } from "../hooks/useCourse";
import { courseSchema } from "../schemas/course.schema";
import CourseForm from "../components/CourseForm";
import { Input } from "../components/formFields";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { courseApi } from "../services/courseApi";

const DEFAULT_VALUES = {
  name: "",
  description: "",
  coverImage: null,
  competencyIds: [],
  sessionCount: "1",
};

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { mutate: createCourse, isPending } = useCreateCourse();
  const { mutate: createSessionsBulk, isPending: creatingSessions } = useCreateSessionsBulk();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(courseSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit, getValues, formState: { isDirty } } = methods;
  const isBusy = isPending || creatingSessions;

  const onSubmit = ({ competencyIds, ...data }) => {
    const sessionCount = Math.max(0, Number(getValues("sessionCount")) || 0);
    createCourse(data, {
      onSuccess: async (course) => {
        if (competencyIds.length > 0) {
          await Promise.all(competencyIds.map((cid) => courseApi.linkCompetency(course.id, cid)));
        }
        if (sessionCount > 0) {
          createSessionsBulk(
            { courseId: course.id, count: sessionCount },
            { onSettled: () => navigate(`/courses/${course.id}/view`) }
          );
        } else {
          navigate(`/courses/${course.id}/view`);
        }
      },
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/courses");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{ display: "flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              ← Courses
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Add Course</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Give the course a name to get started.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-course-form"
            disabled={isBusy}
            style={{ padding: "10px 24px", backgroundColor: isBusy ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isBusy ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "background-color 0.15s" }}
          >
            {isBusy ? (
              <>
                <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#ffffff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                Saving...
              </>
            ) : "Save Course"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <FormProvider {...methods}>
        <form id="create-course-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <CourseForm />

          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px", marginTop: "16px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Sessions</h3>
            <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#9CA3AF" }}>
              How many sessions will this course have? You can add more later.
            </p>
            <div style={{ maxWidth: "160px" }}>
              <Input name="sessionCount" type="number" min="0" label="Number of Sessions" />
            </div>
          </div>
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate("/courses")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
