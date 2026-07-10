import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCourse } from "../hooks/useCourse";
import { courseSchema } from "../schemas/course.schema";
import CourseForm from "../components/CourseForm";
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
};

function genRowId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
}

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { mutate: createCourse, isPending } = useCreateCourse();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [creatingContent, setCreatingContent] = useState(false);
  // Every session belongs to a module — no "ungrouped" sessions — so sessions are defined
  // per-module here: each row is one module, with its own name and session count, created
  // and filled manually rather than an even auto-split across a session/module count.
  const [moduleRows, setModuleRows] = useState([]);

  const methods = useForm({
    resolver: zodResolver(courseSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit, formState: { isDirty } } = methods;
  const isBusy = isPending || creatingContent;

  const addModuleRow = () => {
    setModuleRows((rows) => [...rows, { id: genRowId(), name: `Module ${rows.length + 1}`, sessionCount: "0" }]);
  };
  const updateModuleRow = (rowId, patch) => {
    setModuleRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };
  const removeModuleRow = (rowId) => {
    setModuleRows((rows) => rows.filter((r) => r.id !== rowId));
  };

  const onSubmit = ({ competencyIds, learningAreaIds, ...data }) => {
    createCourse(data, {
      onSuccess: async (course) => {
        setCreatingContent(true);
        if (competencyIds.length > 0) {
          await Promise.all(competencyIds.map((cid) => courseApi.linkCompetency(course.id, cid)));
        }
        if (learningAreaIds.length > 0) {
          await Promise.all(learningAreaIds.map((aid) => courseApi.linkLearningArea(course.id, aid)));
        }
        // Sequential, in row order — createModule/createSessionsBulk both auto-continue
        // ordering across calls, so this naturally produces Module 1's sessions numbered
        // first, then Module 2's, etc.
        for (let i = 0; i < moduleRows.length; i++) {
          const row = moduleRows[i];
          const name = row.name.trim() || `Module ${i + 1}`;
          const count = Math.max(0, Math.min(30, Number(row.sessionCount) || 0));
          const courseModule = await courseApi.createModule(course.id, { name, order: i + 1 });
          if (count > 0) {
            await courseApi.createSessionsBulk(course.id, { count, moduleId: courseModule.id });
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
            <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>Modules & Sessions</h3>
            <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#9CA3AF" }}>
              Optionally define modules now, each with its own name and session count — every session belongs to a module. Leave empty to add modules and sessions later.
            </p>

            {moduleRows.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                {moduleRows.map((row, idx) => (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      value={row.name}
                      onChange={(e) => updateModuleRow(row.id, { name: e.target.value })}
                      placeholder={`Module ${idx + 1}`}
                      style={{ flex: 1, boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
                    />
                    <input
                      type="number" min="0" max="30"
                      value={row.sessionCount}
                      onChange={(e) => updateModuleRow(row.id, { sessionCount: e.target.value })}
                      title="Number of sessions in this module"
                      style={{ width: "110px", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
                    />
                    <span style={{ fontSize: "12px", color: "#9CA3AF", width: "56px", flexShrink: 0 }}>session{row.sessionCount === "1" ? "" : "s"}</span>
                    <button
                      type="button"
                      onClick={() => removeModuleRow(row.id)}
                      title="Remove module"
                      style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: "4px", flexShrink: 0 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addModuleRow}
              style={{ padding: "9px 16px", background: "#fff", color: "#25476a", border: "1.5px dashed #a8d5ee", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              + Add Module
            </button>

            {moduleRows.length > 0 && (
              <p style={{ margin: "10px 0 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>
                {moduleRows.length} module{moduleRows.length !== 1 ? "s" : ""} · {moduleRows.reduce((sum, r) => sum + (Math.max(0, Number(r.sessionCount) || 0)), 0)} session{moduleRows.reduce((sum, r) => sum + (Math.max(0, Number(r.sessionCount) || 0)), 0) !== 1 ? "s" : ""} total
              </p>
            )}
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
