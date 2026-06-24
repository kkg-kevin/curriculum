import { useParams, useNavigate } from "react-router-dom";

/* ── Steps ───────────────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Academic Year" },
  { n: 4, label: "Version Control" },
  { n: 5, label: "Competencies" },
];

/* ── CSS ─────────────────────────────────────────────────────────────────── */

const CSS = `
  .cp-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 32px;
    flex-wrap: nowrap;
  }
  .cp-connector { width: 60px; height: 2px; flex-shrink: 0; margin: 0 6px; margin-bottom: 20px; }
  @media (max-width: 580px) {
    .cp-connector { width: 28px; }
    .cp-steps { justify-content: flex-start; overflow-x: auto; padding-bottom: 4px; }
  }
`;

/* ── StepIndicator ───────────────────────────────────────────────────────── */

function StepIndicator({ current }) {
  return (
    <div className="cp-steps">
      {STEPS.map((step, i) => {
        const done   = step.n < current;
        const active = step.n === current;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%",
                backgroundColor: done || active ? "#25476a" : "#F3F4F6",
                border: `2.5px solid ${done || active ? "#25476a" : "#E5E7EB"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || active ? "#fff" : "#9CA3AF",
                fontSize: done ? "15px" : "13px", fontWeight: "700",
                flexShrink: 0,
                boxShadow: active ? "0 0 0 4px rgba(37,71,106,0.1)" : "none",
              }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: active ? "700" : "400",
                color: active ? "#25476a" : done ? "#374151" : "#9CA3AF",
                whiteSpace: "nowrap",
              }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="cp-connector" style={{ backgroundColor: done ? "#25476a" : "#E5E7EB" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function CompetenciesPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <button
              type="button"
              onClick={() => navigate("/curriculum")}
              style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "12px", fontFamily: "Inter, sans-serif", cursor: "pointer", padding: 0 }}
            >
              Curriculum
            </button>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>Competencies</span>
          </div>
          <h1 style={{ margin: "0 0 3px", fontSize: "22px", fontWeight: "800", color: "#0F2645" }}>Competencies</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Define and manage the competency framework for this curriculum.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => navigate("/curriculum")}
            style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={5} />

      {/* Placeholder body */}
      <div style={{
        textAlign: "center",
        padding: "80px 32px",
        backgroundColor: "#FAFAFA",
        border: "2px dashed #E5E7EB",
        borderRadius: "20px",
      }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>🎯</div>
        <p style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "800", color: "#374151" }}>
          Competencies
        </p>
        <p style={{ margin: 0, fontSize: "14px", color: "#9CA3AF", maxWidth: "400px", marginInline: "auto", lineHeight: "1.6" }}>
          This step is under construction. Once you're ready, competencies will be defined and linked to the curriculum structure here.
        </p>
      </div>
    </div>
  );
}
