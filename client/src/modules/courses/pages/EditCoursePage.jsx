import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useCourseQuery, useUpdateCourse, useCourseLearningAreas, COURSE_KEYS } from "../hooks/useCourse";
import { courseSchema } from "../schemas/course.schema";
import CourseForm from "../components/CourseForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { courseApi } from "../services/courseApi";

export default function EditCoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: course, isLoading, isError } = useCourseQuery(id);
  const { data: linkedLearningAreas, isLoading: learningAreasLoading } = useCourseLearningAreas(id);
  const { mutate: updateCourse, isPending } = useUpdateCourse();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(courseSchema),
    mode: "onTouched",
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  useEffect(() => {
    if (course && linkedLearningAreas) {
      reset({
        name: course.name || "",
        description: course.description || "",
        coverImage: course.coverImage || null,
        ageMin: course.ageMin ?? "",
        ageMax: course.ageMax ?? "",
        learningAreaIds: linkedLearningAreas.map((a) => a.id),
      });
    }
  }, [course, linkedLearningAreas, reset]);

  const onSubmit = ({ learningAreaIds, ...data }) => {
    updateCourse({ id, data }, {
      onSuccess: async () => {
        const originalAreaIds = (linkedLearningAreas || []).map((a) => a.id);
        const areasToAdd = learningAreaIds.filter((aid) => !originalAreaIds.includes(aid));
        const areasToRemove = originalAreaIds.filter((aid) => !learningAreaIds.includes(aid));
        await Promise.all([
          ...areasToAdd.map((aid) => courseApi.linkLearningArea(id, aid)),
          ...areasToRemove.map((aid) => courseApi.unlinkLearningArea(id, aid)),
        ]);
        queryClient.invalidateQueries({ queryKey: COURSE_KEYS.learningAreas(id) });
        navigate(`/courses/${id}/view`);
      },
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(`/courses/${id}/view`);
  };

  if (isLoading || learningAreasLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading course…
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Course not found.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <button
              type="button"
              onClick={() => navigate(`/courses/${id}/view`)}
              style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              ← {course.name}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Edit Course</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Update the course details.
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
            form="edit-course-form"
            disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "background-color 0.15s" }}
          >
            {isPending ? (
              <>
                <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#ffffff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                Saving…
              </>
            ) : "Save Changes"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <FormProvider {...methods}>
        <form id="edit-course-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <CourseForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(`/courses/${id}/view`)}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
