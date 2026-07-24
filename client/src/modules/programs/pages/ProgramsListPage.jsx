import { useNavigate } from "react-router-dom";
import { FiLayers } from "react-icons/fi";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";
import CurriculumCard from "../../curriculum/components/CurriculumCard";

function EmptyState({ onCreateNew }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a", margin: "0 auto 20px" }}>
        <FiLayers size={32} strokeWidth={1.8} />
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>No programs yet</h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6", maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
        A Program is a curriculum built through the same Basic Info → Structure → Competencies → Version Control flow as any other,
        just flagged "This is a Program" on the Structure step — ideal for a short-run cohort like a bootcamp.
      </p>
      <button type="button" onClick={onCreateNew} style={{ padding: "10px 24px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 4px 12px rgba(254,177,57,0.35)" }}>
        + New Program
      </button>
    </div>
  );
}

export default function ProgramsListPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useCurriculaQuery();

  // Programs are curricula flagged isProgram: true on the Structure step — see
  // CurriculumStructurePage.jsx and CurriculumPage.jsx (which excludes them).
  const programs = (data?.data || []).filter((c) => c.isProgram);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Programs
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "520px" }}>
              Short-run cohort curricula — bootcamps, intensives — authored the same way as any curriculum, then deployed to a hub as a running class.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/curriculum/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            New Program
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "#F3F4F6" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 15, width: "60%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                  <div style={{ height: 11, width: "40%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                </div>
              </div>
              <div style={{ height: 40, backgroundColor: "#F9FAFB", borderRadius: 12 }} />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
          ⚠ Failed to load programs: {error?.message}
        </div>
      ) : programs.length === 0 ? (
        <EmptyState onCreateNew={() => navigate("/curriculum/create")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {programs.map((curriculum) => (
            <CurriculumCard key={curriculum.id} curriculum={curriculum} />
          ))}
        </div>
      )}
    </div>
  );
}
