import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateProject } from "../hooks/useSiteContent";
import { projectSchema, PROJECT_DEFAULT_VALUES } from "../schemas/siteContent.schema";
import ProjectForm from "../components/ProjectForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const { mutate: createProject, isPending } = useCreateProject();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: PROJECT_DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit, formState: { isDirty } } = methods;

  const onSubmit = (data) => {
    createProject(data, { onSuccess: () => navigate("/site-content") });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/site-content");
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
              ← Website Content
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>New Project</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Add Project</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Content shown on the public marketing site's Projects page.
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
            form="create-project-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Saving…" : "Save Project"}
          </button>
        </div>
      </div>

      <FormProvider {...methods}>
        <form id="create-project-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
