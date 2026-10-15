import { useState, useEffect, useRef } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useWatch, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useCourseQuery, useUpdateCourse, useCoursePathways, useCourseCompetencies, COURSE_KEYS } from "../hooks/useCourse";
import { courseSchema } from "../schemas/course.schema";
import CourseForm from "../components/CourseForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { courseApi } from "../services/courseApi";
import { useDraft, isSameContent } from "../../../hooks/useDraft";
import DraftRestoreDialog, { DraftSavedNote } from "../../../components/ui/DraftRestoreDialog";

export default function EditCoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: course, isLoading, isError } = useCourseQuery(id);
  const { data: linkedPathways, isLoading: pathwaysLoading } = useCoursePathways(id);
  const { data: linkedCompetencies, isLoading: competenciesLoading } = useCourseCompetencies(id);
  const { mutate: updateCourse, isPending } = useUpdateCourse();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(courseSchema),
    mode: "onTouched",
  });

  const { handleSubmit, reset, control, formState: { isDirty } } = methods;
  // The course as loaded into the form. Filled once per course: a background refetch (coming back
  // to the tab after a while) must not reload the form over unsaved edits.
  const loaded = useRef(null);

  useEffect(() => {
    if (course && linkedPathways && linkedCompetencies && loaded.current?.id !== id) {
      const values = {
        name: course.name || "",
        code: course.code || "",
        status: course.status || "draft",
        description: course.description || "",
        coverImage: course.coverImage || null,
        ageMin: course.ageMin ?? "",
        ageMax: course.ageMax ?? "",
        pathwayIds: linkedPathways.map((a) => a.id),
        competencyIds: linkedCompetencies.map((c) => c.id),
        requirements: course.requirements || [],
      };
      loaded.current = { id, values };
      reset(values);
    }
  }, [id, course, linkedPathways, linkedCompetencies, reset]);

  // Unsaved work is kept in this browser as it's typed and offered back next time (useDraft).
  const values = useWatch({ control });
  const draft = useDraft(loaded.current?.id === id ? `course:edit:${id}` : null, {
    value: values,
    dirty: loaded.current?.id === id && !isSameContent(values, loaded.current.values),
    baseUpdatedAt: course?.updatedAt ?? null,
    saved: loaded.current?.values,
  });
  const restoreDraft = () => {
    const restored = draft.restore();
    if (restored) reset({ ...loaded.current.values, ...restored }, { keepDefaultValues: true });
  };

  const onSubmit = ({ pathwayIds, competencyIds, ...data }) => {
    updateCourse({ id, data }, {
      onSuccess: async () => {
        draft.clear();
        const originalAreaIds = (linkedPathways || []).map((a) => a.id);
        const areasToAdd = pathwayIds.filter((aid) => !originalAreaIds.includes(aid));
        const areasToRemove = originalAreaIds.filter((aid) => !pathwayIds.includes(aid));
        const originalCompetencyIds = (linkedCompetencies || []).map((c) => c.id);
        const competenciesToAdd = competencyIds.filter((cid) => !originalCompetencyIds.includes(cid));
        const competenciesToRemove = originalCompetencyIds.filter((cid) => !competencyIds.includes(cid));
        await Promise.all([
          ...areasToAdd.map((aid) => courseApi.linkPathway(id, aid)),
          ...areasToRemove.map((aid) => courseApi.unlinkPathway(id, aid)),
          ...competenciesToAdd.map((cid) => courseApi.linkCompetency(id, cid)),
          ...competenciesToRemove.map((cid) => courseApi.unlinkCompetency(id, cid)),
        ]);
        queryClient.invalidateQueries({ queryKey: COURSE_KEYS.pathways(id) });
        queryClient.invalidateQueries({ queryKey: COURSE_KEYS.competencies(id) });
        navigate(`/courses/${id}/view`);
      },
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(`/courses/${id}/view`);
  };

  if (isLoading || pathwaysLoading || competenciesLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading course…
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px", display: "flex", alignItems: "center", gap: 8 }}>
        <FiAlertTriangle size={15} /> Course not found.
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
          <DraftSavedNote savedAt={draft.savedAt} />
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
        onConfirm={() => { draft.clear(); navigate(`/courses/${id}/view`); }}
        onCancel={() => setConfirmLeave(false)}
      />
      <DraftRestoreDialog
        draft={draft.found}
        recordUpdatedAt={course?.updatedAt ?? null}
        what="course"
        onRestore={restoreDraft}
        onDiscard={draft.discard}
      />
    </div>
  );
}
