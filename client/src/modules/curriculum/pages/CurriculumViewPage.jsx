import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";

export default function CurriculumViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: curriculum, isLoading, isError } = useCurriculumQuery(id);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "#9CA3AF", fontFamily: "Inter, sans-serif", fontSize: "14px" }}>
        Loading curriculum...
      </div>
    );
  }

  if (isError || !curriculum) {
    return (
      <div style={{ padding: "24px", fontFamily: "Inter, sans-serif" }}>
        <div style={{ padding: "16px 20px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
          ⚠ Could not load curriculum.
        </div>
      </div>
    );
  }

  const structure = curriculum.structure || [];
  const totalClasses = structure.reduce((s, t) => s + (t.grades?.length || 0), 0);
  const totalCourses = structure.reduce(
    (s, t) => s + (t.grades?.reduce((gs, g) => gs + (g.courses?.length || 0), 0) || 0),
    0
  );

  const termLabel = (period, i) => {
    if (period?.name) return period.name;
    if (curriculum.academicCycleModel === "semesters") return `Semester ${i + 1}`;
    if (curriculum.academicCycleModel === "terms") return `Term ${i + 1}`;
    return `Period ${i + 1}`;
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", maxWidth: "860px", margin: "0 auto" }}>
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate("/curriculum")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "20px",
          padding: "7px 14px",
          backgroundColor: "transparent",
          color: "#0D47A1",
          border: "1.5px solid #BFDBFE",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: "600",
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      {/* Header card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          overflow: "hidden",
          marginBottom: "20px",
        }}
      >
        <div style={{ height: "4px", background: "linear-gradient(90deg, #0D47A1, #42A5F5)" }} />
        <div style={{ padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
            <div>
              <h1 style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: "800", color: "#0F2645" }}>
                {curriculum.name}
              </h1>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>
                {curriculum.code} · {curriculum.academicYear}
              </span>
            </div>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: "600",
                backgroundColor: "#EFF6FF",
                color: "#1D4ED8",
                border: "1px solid #BFDBFE",
                flexShrink: 0,
              }}
            >
              {curriculum.framework}
            </span>
          </div>

          {curriculum.description && (
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#4B5563", lineHeight: "1.6" }}>
              {curriculum.description}
            </p>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {[
              { label: "Periods", value: curriculum.periods?.length || 0 },
              { label: "Classes", value: totalClasses },
              { label: "Courses", value: totalCourses },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  backgroundColor: "#EFF6FF",
                  borderRadius: "10px",
                  padding: "10px 16px",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: "0 0 2px 0", fontSize: "10px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {s.label}
                </p>
                <p style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#1D4ED8" }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Structure section */}
      {structure.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {(curriculum.periods || []).map((period, termIdx) => {
            const termData = structure[termIdx] || { grades: [] };
            const grades = termData.grades || [];
            return (
              <div
                key={termIdx}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "14px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  overflow: "hidden",
                }}
              >
                {/* Term header */}
                <div
                  style={{
                    padding: "14px 20px",
                    backgroundColor: "#F8FAFF",
                    borderBottom: "1px solid #E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#0D47A1" }}>
                    {termLabel(period, termIdx)}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#1D4ED8",
                      backgroundColor: "#EFF6FF",
                      padding: "2px 9px",
                      borderRadius: "20px",
                      border: "1px solid #BFDBFE",
                    }}
                  >
                    {grades.length} class{grades.length !== 1 ? "es" : ""}
                  </span>
                </div>

                {grades.length === 0 ? (
                  <div style={{ padding: "20px", fontSize: "13px", color: "#9CA3AF", fontStyle: "italic", textAlign: "center" }}>
                    No classes added
                  </div>
                ) : (
                  <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {grades.map((grade) => (
                      <div
                        key={grade.id}
                        style={{
                          padding: "12px 16px",
                          backgroundColor: "#F8FAFF",
                          border: "1px solid #E0ECFF",
                          borderRadius: "10px",
                        }}
                      >
                        <p style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "700", color: "#1E3A5F" }}>
                          {grade.name}
                        </p>
                        {grade.courses?.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {grade.courses.map((course) => (
                              <span
                                key={course.id}
                                style={{
                                  padding: "3px 10px",
                                  backgroundColor: "#EFF6FF",
                                  color: "#1D4ED8",
                                  border: "1px solid #BFDBFE",
                                  borderRadius: "20px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                }}
                              >
                                {course.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>No courses</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏗</div>
          <p style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#374151" }}>
            No structure yet
          </p>
          <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#9CA3AF" }}>
            Use the Structure Builder to add classes and courses.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/curriculum/${id}/structure`)}
            style={{
              padding: "9px 20px",
              backgroundColor: "#0D47A1",
              color: "#fff",
              border: "none",
              borderRadius: "9px",
              fontSize: "13px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            Open Structure Builder
          </button>
        </div>
      )}
    </div>
  );
}
