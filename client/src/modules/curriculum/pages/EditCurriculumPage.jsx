import { useParams, useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCurriculumQuery, useUpdateCurriculum } from "../hooks/useCurriculum";
import { createCurriculumSchema } from "../schemas/curriculum.schema";
import CurriculumForm from "../components/CurriculumForm";
import CurriculumPreview from "../components/CurriculumPreview";

/* ── Inner form (only renders once curriculum is loaded) ─────────────── */

function EditCurriculumForm({ curriculum }) {
  const navigate = useNavigate();
  const { mutate: updateCurriculum, isPending } = useUpdateCurriculum();

  const methods = useForm({
    resolver: zodResolver(createCurriculumSchema),
    defaultValues: {
      name: curriculum.name || "",
      code: curriculum.code || "",
      academicYear: curriculum.academicYear || "",
      description: curriculum.description || "",
      framework: curriculum.framework || "",
      academicCycleModel: curriculum.academicCycleModel || "terms",
      periods: curriculum.periods || [],
    },
    mode: "onTouched",
  });

  const {
    handleSubmit,
    formState: { isDirty },
  } = methods;

  const onSubmit = (data) => {
    updateCurriculum(
      { id: curriculum.id, data },
      { onSuccess: () => navigate("/curriculum") }
    );
  };

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm("You have unsaved changes. Leave anyway?")) {
        navigate("/curriculum");
      }
    } else {
      navigate("/curriculum");
    }
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "2px",
            }}
          >
            <button
              type="button"
              onClick={handleCancel}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "0",
                background: "none",
                border: "none",
                color: "#6B7280",
                fontSize: "13px",
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              ← Curriculum
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span
              style={{
                fontSize: "13px",
                color: "#6B7280",
                maxWidth: "200px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {curriculum.name}
            </span>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>
              Edit
            </span>
          </div>
          <h1
            style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}
          >
            Edit Curriculum
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Update the structure and academic calendar
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: "10px 20px",
              backgroundColor: "transparent",
              color: "#374151",
              border: "1.5px solid #E5E7EB",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="edit-curriculum-form"
            disabled={isPending}
            style={{
              padding: "10px 24px",
              backgroundColor: isPending ? "#93C5FD" : "#0D47A1",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: isPending ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background-color 0.15s",
            }}
          >
            {isPending ? (
              <>
                <span
                  style={{
                    width: "14px",
                    height: "14px",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#ffffff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 2-column layout */}
      <FormProvider {...methods}>
        <form id="edit-curriculum-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
            {/* Left — Form */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <CurriculumForm />
            </div>

            {/* Right — Live Preview */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                position: "sticky",
                top: "24px",
                alignSelf: "flex-start",
                maxHeight: "calc(100vh - 140px)",
                overflowY: "auto",
                paddingRight: "2px",
              }}
            >
              <CurriculumPreview />
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

/* ── Page shell (handles loading / error) ────────────────────────────── */

export default function EditCurriculumPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: curriculum, isLoading, isError } = useCurriculumQuery(id);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "400px",
          fontFamily: "Inter, sans-serif",
          gap: "14px",
          color: "#6B7280",
          fontSize: "14px",
        }}
      >
        <span
          style={{
            width: "28px",
            height: "28px",
            border: "3px solid #E5E7EB",
            borderTopColor: "#0D47A1",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        Loading curriculum...
      </div>
    );
  }

  if (isError || !curriculum) {
    return (
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
          padding: "60px 20px",
        }}
      >
        <p style={{ fontSize: "16px", color: "#EF4444", marginBottom: "16px" }}>
          Could not load curriculum.
        </p>
        <button
          type="button"
          onClick={() => navigate("/curriculum")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#0D47A1",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
          }}
        >
          ← Back to Curriculum
        </button>
      </div>
    );
  }

  return <EditCurriculumForm curriculum={curriculum} />;
}
