import { useState, useEffect } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProjectsQuery, useUpdateProject } from "../hooks/useSiteContent";
import { projectSchema } from "../schemas/siteContent.schema";
import ProjectForm from "../components/ProjectForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

// No GET /api/site/projects/:id on the server (list/create/update/delete only — see
// admin-site.routes.js) — the record to edit is looked up from the already-fetched list.
export default function EditProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProjectsQuery();
  const { mutate: updateProject, isPending } = useUpdateProject();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const project = (data?.data || []).find((p) => p.id === id);

  const methods = useForm({
    resolver: zodResolver(projectSchema),
    mode: "onTouched",
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  useEffect(() => {
    if (project) {
      reset({
        name: project.name || "",
        description: project.description || "",
        coverImage: project.coverImage || null,
        ageMin: project.ageMin ?? "",
        ageMax: project.ageMax ?? "",
        sessionCount: project.sessionCount ?? "",
        requirements: project.requirements || [],
        modules: project.modules || [],
        isPublished: project.isPublished ?? true,
      });
    }
  }, [project, reset]);

  const onSubmit = (formData) => {
    updateProject({ id, data: formData }, { onSuccess: () => navigate("/site-content") });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/site-content");
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading project…
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px", display: "flex", alignItems: "center", gap: 8 }}>
        <FiAlertTriangle size={15} /> Project not found.
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
              onClick={() => navigate("/site-content")}
              style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              ← {project.name}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Edit Project</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Update the project details.
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
            form="edit-project-form"
            disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <FormProvider {...methods}>
        <form id="edit-project-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <ProjectForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate("/site-content")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
