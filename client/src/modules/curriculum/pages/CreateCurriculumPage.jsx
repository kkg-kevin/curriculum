import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCurriculum } from "../hooks/useCurriculum";
import { createCurriculumSchema } from "../schemas/curriculum.schema";
import CurriculumForm from "../components/CurriculumForm";
import CurriculumPreview from "../components/CurriculumPreview";

const DEFAULT_VALUES = {
  name: "",
  code: "",
  academicYear: "",
  description: "",
  framework: "",
  academicCycleModel: "terms",
  periods: [
    { name: "Term 1", startDate: "", endDate: "", midTermBreakStartDate: "", midTermBreakEndDate: "" },
    { name: "Term 2", startDate: "", endDate: "", midTermBreakStartDate: "", midTermBreakEndDate: "" },
    { name: "Term 3", startDate: "", endDate: "", midTermBreakStartDate: "", midTermBreakEndDate: "" },
  ],
};

export default function CreateCurriculumPage() {
  const navigate = useNavigate();
  const { mutate: createCurriculum, isPending } = useCreateCurriculum();

  const methods = useForm({
    resolver: zodResolver(createCurriculumSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const {
    handleSubmit,
    formState: { isDirty, isValid, errors },
  } = methods;

  const onSubmit = (data) => {
    createCurriculum(data, {
      onSuccess: () => navigate("/curriculum"),
    });
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
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
                textDecoration: "none",
              }}
            >
              ← Curriculum
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>
            Create Curriculum
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Define the structure and academic calendar for a new curriculum
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
            form="create-curriculum-form"
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
                Creating...
              </>
            ) : (
              "Create Curriculum"
            )}
          </button>
        </div>
      </div>

      {/* Spinner keyframes injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 2-column layout */}
      <FormProvider {...methods}>
        <form
          id="create-curriculum-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "flex-start",
            }}
          >
            {/* Left column — Form */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <CurriculumForm />
            </div>

            {/* Right column — Live Preview */}
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
