import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCurriculum } from "../hooks/useCurriculum";
import { curriculumDetailsSchema } from "../schemas/curriculum.schema";
import CurriculumForm from "../components/CurriculumForm";
import CurriculumPreview from "../components/CurriculumPreview";
import ConfirmDialog from "../components/ConfirmDialog";

/* ── Step indicator ─────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Academic Year" },
  { n: 4, label: "Version Control" },
  { n: 5, label: "Competencies" },
];

function StepIndicator({ current }) {
  return (
    <div className="ccp-steps">
      {STEPS.map((step, i) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%",
                backgroundColor: done || active ? "#25476a" : "#F3F4F6",
                border: `2px solid ${done || active ? "#25476a" : "#E5E7EB"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || active ? "#fff" : "#9CA3AF",
                fontSize: done ? "15px" : "13px",
                fontWeight: "700",
                transition: "all 0.2s",
                flexShrink: 0,
              }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: active ? "600" : "400",
                color: active ? "#25476a" : done ? "#374151" : "#9CA3AF",
                whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="ccp-connector" style={{
                height: "2px",
                backgroundColor: done ? "#25476a" : "#E5E7EB",
                margin: "0 6px",
                marginBottom: "20px",
                flexShrink: 0,
                transition: "background-color 0.2s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <span style={{
      width: "14px", height: "14px",
      border: "2px solid rgba(255,255,255,0.4)",
      borderTopColor: "#ffffff",
      borderRadius: "50%",
      display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

const DEFAULT_VALUES = { name: "", code: "", description: "" };

export default function CreateCurriculumPage() {
  const navigate = useNavigate();
  const { mutate: createCurriculum, isPending } = useCreateCurriculum();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(curriculumDetailsSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit, formState: { isDirty } } = methods;

  const onSubmit = (data) => {
    createCurriculum(data, {
      onSuccess: (curriculum) => navigate(`/curriculum/${curriculum.id}/structure`),
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate("/curriculum");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .ccp-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 32px;
          flex-wrap: nowrap;
        }
        .ccp-connector { width: 60px; }

        .ccp-layout {
          display: flex;
          gap: 24px;
          align-items: flex-start;
        }
        .ccp-form-col { flex: 1; min-width: 0; }
        .ccp-preview-col {
          flex: 1;
          min-width: 0;
          position: sticky;
          top: 24px;
          align-self: flex-start;
          max-height: calc(100vh - 140px);
          overflow-y: auto;
          padding-right: 2px;
        }

        @media (max-width: 768px) {
          .ccp-steps { justify-content: flex-start; overflow-x: auto; padding-bottom: 4px; }
          .ccp-connector { width: 40px; }
          .ccp-layout { flex-direction: column; }
          .ccp-form-col { order: 1; }
          .ccp-preview-col {
            order: 2;
            position: static;
            max-height: none;
            width: 100%;
          }
        }
      `}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "0", background: "none", border: "none",
                color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer",
              }}
            >
              ← Curriculum
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Create Curriculum</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Enter basic details — you'll configure structure and academic periods in the next steps.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: "10px 20px",
              backgroundColor: "transparent", color: "#374151",
              border: "1.5px solid #E5E7EB", borderRadius: "10px",
              fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer",
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
              backgroundColor: isPending ? "#b8d9ee" : "#25476a",
              color: "#ffffff", border: "none", borderRadius: "10px",
              fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif",
              cursor: isPending ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "8px",
              transition: "background-color 0.15s",
            }}
          >
            {isPending ? <><Spinner /> Creating…</> : "Next: Structure →"}
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={1} />

      {/* Two-column layout */}
      <FormProvider {...methods}>
        <form id="create-curriculum-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="ccp-layout">
            <div className="ccp-form-col">
              <CurriculumForm />
            </div>
            <div className="ccp-preview-col">
              <CurriculumPreview />
            </div>
          </div>
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave this page."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate("/curriculum")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
