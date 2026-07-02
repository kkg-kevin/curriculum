import { useNavigate, useParams } from "react-router-dom";
import { useAssessmentQuery } from "../hooks/useAssessment";

const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", project: "Project", assignment: "Assignment" };
const TYPE_ICONS = { quiz: "📝", exam: "🎓", project: "🛠️", assignment: "📄" };

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {title}
        </h2>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: "0 0 1px 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: "14px", color: "#111827" }}>{value}</p>
    </div>
  );
}

export default function AssessmentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: assessment, isLoading, isError } = useAssessmentQuery(id);

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading assessment…
      </div>
    );
  }

  if (isError || !assessment) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Assessment not found.
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[assessment.status] || STATUS_STYLES.inactive;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <button type="button" onClick={() => navigate("/assessments")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
              Assessments
            </button>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: "500" }}>{assessment.name}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", flexShrink: 0 }}>
                {TYPE_ICONS[assessment.type] || "📋"}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.3px" }}>
                    {assessment.name}
                  </h1>
                  <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, textTransform: "capitalize" }}>
                    {assessment.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                  {TYPE_LABELS[assessment.type] || assessment.type}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/assessments/${id}/edit`)}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Edit Assessment
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>
        <Section title="Description">
          {assessment.description ? (
            <p style={{ margin: 0, fontSize: "14px", color: "#374151", lineHeight: "1.65" }}>{assessment.description}</p>
          ) : (
            <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No description added</p>
          )}
        </Section>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Section title="Details">
            <DetailRow label="Type" value={TYPE_LABELS[assessment.type] || assessment.type} />
          </Section>

          <Section title="Record Info">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <DetailRow
                label="Created"
                value={new Date(assessment.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
              />
              <DetailRow
                label="Last Updated"
                value={new Date(assessment.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
