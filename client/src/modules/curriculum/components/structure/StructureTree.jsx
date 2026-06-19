export default function StructureTree({ curriculum, structure, selectedTermIndex, onSelectTerm }) {
  const periods = curriculum?.periods || [];
  const model = curriculum?.academicCycleModel || "terms";

  const termLabel = (period, i) => {
    if (period?.name) return period.name;
    if (model === "semesters") return `Semester ${i + 1}`;
    if (model === "terms") return `Term ${i + 1}`;
    return `Period ${i + 1}`;
  };

  const totalGrades = structure.reduce((s, t) => s + (t.grades?.length || 0), 0);
  const totalCourses = structure.reduce(
    (s, t) => s + (t.grades?.reduce((gs, g) => gs + (g.courses?.length || 0), 0) || 0),
    0
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Curriculum info */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #E5E7EB",
          backgroundColor: "#F8FAFF",
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: "10px",
            fontWeight: "700",
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "6px",
          }}
        >
          Curriculum
        </span>
        <p
          style={{
            margin: "0 0 6px 0",
            fontSize: "14px",
            fontWeight: "700",
            color: "#0F2645",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {curriculum?.name || "—"}
        </p>
        {curriculum?.code && (
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              backgroundColor: "#EFF6FF",
              color: "#1D4ED8",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "600",
              border: "1px solid #BFDBFE",
            }}
          >
            {curriculum.code}
          </span>
        )}
        {/* Summary */}
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <div style={{ flex: 1, backgroundColor: "#EFF6FF", borderRadius: "8px", padding: "6px 8px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#1D4ED8" }}>{totalGrades}</p>
            <p style={{ margin: 0, fontSize: "10px", color: "#93C5FD", fontWeight: "600" }}>Classes</p>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F0FDF4", borderRadius: "8px", padding: "6px 8px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#16A34A" }}>{totalCourses}</p>
            <p style={{ margin: 0, fontSize: "10px", color: "#86EFAC", fontWeight: "600" }}>Courses</p>
          </div>
        </div>
      </div>

      {/* Term list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <p
          style={{
            margin: "10px 14px 6px 14px",
            fontSize: "10px",
            fontWeight: "700",
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Academic Periods
        </p>

        {periods.map((period, i) => {
          const termStruct = structure[i] || { grades: [] };
          const gradeCount = termStruct.grades?.length || 0;
          const courseCount =
            termStruct.grades?.reduce((s, g) => s + (g.courses?.length || 0), 0) || 0;
          const isSelected = selectedTermIndex === i;
          const isConfigured = gradeCount > 0;
          const label = termLabel(period, i);

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectTerm(i)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                backgroundColor: isSelected ? "#EFF6FF" : "transparent",
                boxShadow: isSelected ? "inset 3px 0 0 #0D47A1" : "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "Inter, sans-serif",
                transition: "background-color 0.15s",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  flexShrink: 0,
                  background: isSelected
                    ? "linear-gradient(135deg, #0D47A1, #1976D2)"
                    : isConfigured
                    ? "#F0FDF4"
                    : "#F3F4F6",
                  color: isSelected ? "#fff" : isConfigured ? "#16A34A" : "#9CA3AF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isConfigured && !isSelected ? "14px" : "13px",
                  fontWeight: "700",
                }}
              >
                {isConfigured && !isSelected ? "✓" : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    fontWeight: "600",
                    color: isSelected ? "#0D47A1" : "#374151",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {label}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                  {gradeCount} {gradeCount === 1 ? "class" : "classes"} · {courseCount}{" "}
                  {courseCount === 1 ? "course" : "courses"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
