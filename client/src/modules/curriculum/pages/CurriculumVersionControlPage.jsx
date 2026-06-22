import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import VersionHistory from "../components/VersionHistory";

export default function CurriculumVersionControlPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const { data: curriculum } = useCurriculumQuery(id);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => navigate(`/curriculum/${id}/view`)}
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 13px", backgroundColor: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "9px", fontSize: "13px", fontWeight: "500", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {curriculum?.name || "Curriculum"}
        </button>
        <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
        <span style={{ fontSize: "13px", color: "#111827", fontWeight: "600" }}>Version Control</span>
      </div>

      {/* Page title */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: "800", color: "#111827", letterSpacing: "-0.3px" }}>
          Version Control
        </h1>
        {curriculum?.name && (
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{curriculum.name}</p>
        )}
      </div>

      <VersionHistory curriculumId={id} />
    </div>
  );
}
