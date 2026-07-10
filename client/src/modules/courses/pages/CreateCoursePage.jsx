import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCourse } from "../hooks/useCourse";
import { courseSchema } from "../schemas/course.schema";
import CourseForm from "../components/CourseForm";
import { Input } from "../components/formFields";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { courseApi } from "../services/courseApi";

const DEFAULT_VALUES = {
  name: "",
  description: "",
  coverImage: null,
  ageMin: "",
  ageMax: "",
  competencyIds: [],
  learningAreaIds: [],
  sessionCount: "1",
  moduleCount: "0",
};

// Spreads `sessionCount` sessions across `moduleCount` modules as evenly as possible,
// putting any remainder in the earliest modules (e.g. 31 sessions / 3 modules -> 11/10/10).
function distributeSessions(sessionCount, moduleCount) {
  const base = Math.floor(sessionCount / moduleCount);
  const remainder = sessionCount % moduleCount;
  return Array.from({ length: moduleCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { mutate: createCourse, isPending } = useCreateCourse();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [creatingContent, setCreatingContent] = useState(false);

  const methods = useForm({
    resolver: zodResolver(courseSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit, getValues, formState: { isDirty } } = methods;
  const isBusy = isPending || creatingContent;

  const onSubmit = ({ competencyIds, learningAreaIds, ...data }) => {
    const sessionCount = Math.max(0, Number(getValues("sessionCount")) || 0);
    // Every session belongs to a module — no "ungrouped" sessions — so any sessions being
    // created here need at least 1 module; default to 1 (holding them all) if left blank.
    const moduleCount = sessionCount > 0 ? Math.max(1, Number(getValues("moduleCount")) || 1) : 0;
    createCourse(data, {
      onSuccess: async (course) => {
        setCreatingContent(true);
        if (competencyIds.length > 0) {
          await Promise.all(competencyIds.map((cid) => courseApi.linkCompetency(course.id, cid)));
        }
        if (learningAreaIds.length > 0) {
          await Promise.all(learningAreaIds.map((aid) => courseApi.linkLearningArea(course.id, aid)));
        }
        if (sessionCount > 0) {
          // Create the modules first, then bulk-create each module's share of sessions in
          // order — createSessionsBulk continues global session ordering across calls.
          const counts = distributeSessions(sessionCount, moduleCount);
          for (let i = 0; i < moduleCount; i++) {
            const courseModule = await courseApi.createModule(course.id, { name: `Module ${i + 1}`, order: i + 1 });
            if (counts[i] > 0) {
              await courseApi.createSessionsBulk(course.id, { count: counts[i], moduleId: courseModule.id });
            }
          }
        }
        navigate(`/courses/${course.id}/view`);
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
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ maxWidth: "160px" }}>
                <Input name="sessionCount" type="number" min="0" label="Number of Sessions" />
              </div>
              <div style={{ maxWidth: "160px" }}>
                <Input name="moduleCount" type="number" min="0" label="Number of Modules" />
              </div>
            </div>
            <p style={{ margin: "10px 0 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>
              Sessions are always split evenly across named modules (e.g. 30 sessions ÷ 3 modules = 10 each). Leave at 0 to use a single module holding all sessions; you can add more modules later too.
            </p>
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
