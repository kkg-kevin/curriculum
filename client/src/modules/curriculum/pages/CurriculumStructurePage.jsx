import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery, useUpdateStructure } from "../hooks/useCurriculum";
import StructureContent from "../components/structure/StructureContent";
import StructureOverview from "../components/structure/StructureOverview";

export default function CurriculumStructurePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: curriculum, isLoading, isError } = useCurriculumQuery(id);
  const { mutate: saveStructure, isPending: isSaving } = useUpdateStructure();

  const [structure, setStructure] = useState([]);

  useEffect(() => {
    if (curriculum) {
      const existing = curriculum.structure || [];
      const initialized = (curriculum.periods || []).map(
        (_, i) => existing[i] || { grades: [] }
      );
      setStructure(initialized);
    }
  }, [curriculum]);

  const handleUpdateTerm = (termIndex, termData) => {
    setStructure((prev) =>
      prev.map((t, i) => (i === termIndex ? { ...t, ...termData } : t))
    );
  };

  const handleSave = () => {
    saveStructure({ id, structure });
  };

  /* ── Loading ─────────────────────────────────────────────────────── */
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

  /* ── Error ───────────────────────────────────────────────────────── */
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

  /* ── Page ────────────────────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          {/* Breadcrumb */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/curriculum")}
              style={{
                background: "none",
                border: "none",
                color: "#6B7280",
                fontSize: "13px",
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                padding: 0,
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
              Structure
            </span>
          </div>
          <h1
            style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}
          >
            Structure Builder
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Expand each term to add classes and courses
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => navigate("/curriculum")}
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
            Done
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "10px 24px",
              backgroundColor: isSaving ? "#93C5FD" : "#0D47A1",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: isSaving ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background-color 0.15s",
            }}
          >
            {isSaving ? (
              <>
                <span
                  style={{
                    width: "14px",
                    height: "14px",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Saving...
              </>
            ) : (
              "💾  Save Structure"
            )}
          </button>
        </div>
      </div>

      {/* Body — accordion + sidebar */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        {/* Main accordion */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <StructureContent
            curriculum={curriculum}
            structure={structure}
            onUpdateTerm={handleUpdateTerm}
          />
        </div>

        {/* Right sidebar */}
        <div
          style={{
            width: "270px",
            flexShrink: 0,
            position: "sticky",
            top: "24px",
            alignSelf: "flex-start",
          }}
        >
          <StructureOverview
            curriculum={curriculum}
            structure={structure}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  );
}
