import { PieChart, Pie, Cell, Tooltip } from "recharts";

const CHART_COLORS = ["#0D47A1", "#1976D2", "#2196F3", "#42A5F5", "#90CAF9", "#BBDEFB"];

export default function StructureOverview({ curriculum, structure, onSave, isSaving }) {
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
  const configuredTerms = structure.filter((t) => (t.grades?.length || 0) > 0).length;
  const completionPct =
    periods.length > 0 ? Math.round((configuredTerms / periods.length) * 100) : 0;

  const chartData = periods
    .map((period, i) => {
      const t = structure[i] || { grades: [] };
      const count = t.grades?.reduce((s, g) => s + (g.courses?.length || 0), 0) || 0;
      return { name: termLabel(period, i), value: count };
    })
    .filter((d) => d.value > 0);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* ── Stats card ─────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "14px",
          border: "1.5px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#F8FAFF",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Overview
          </span>
          {completionPct === 100 && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "#1D4ED8",
                backgroundColor: "#EFF6FF",
                padding: "2px 8px",
                borderRadius: "20px",
                border: "1px solid #BFDBFE",
              }}
            >
              ✓ All set
            </span>
          )}
        </div>

        <div style={{ padding: "14px 16px" }}>
          {/* Stats grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "14px",
            }}
          >
            {[
              { label: "Classes", value: totalGrades, bg: "#EFF6FF", color: "#1D4ED8" },
              { label: "Courses", value: totalCourses, bg: "#DBEAFE", color: "#1565C0" },
              {
                label: "Terms Set Up",
                value: `${configuredTerms}/${periods.length}`,
                bg: "#EFF6FF",
                color: "#1E40AF",
              },
              {
                label: "Completion",
                value: `${completionPct}%`,
                bg: "#E0F2FE",
                color: "#0369A1",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  backgroundColor: stat.bg,
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <p
                  style={{
                    margin: "0 0 2px 0",
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {stat.label}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "21px",
                    fontWeight: "800",
                    color: stat.color,
                    lineHeight: 1.1,
                  }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "5px",
              }}
            >
              <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Setup progress</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>
                {configuredTerms}/{periods.length} terms
              </span>
            </div>
            <div
              style={{
                height: "6px",
                backgroundColor: "#F3F4F6",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: "10px",
                  width: `${completionPct}%`,
                  background: "linear-gradient(90deg, #0D47A1, #42A5F5)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart card ─────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "14px",
          border: "1.5px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#F8FAFF",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Courses per Term
          </span>
        </div>

        <div style={{ padding: "14px 16px" }}>
          {chartData.length > 0 ? (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
                <PieChart width={150} height={150}>
                  <Pie
                    data={chartData}
                    cx={75}
                    cy={75}
                    innerRadius={38}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "12px",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                  />
                </PieChart>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {chartData.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "3px",
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: "12px", color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.name}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#111827", flexShrink: 0 }}>
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "20px 16px",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>
                Add courses to see the chart
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Save button ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        style={{
          width: "100%",
          padding: "13px",
          backgroundColor: isSaving ? "#93C5FD" : "#0D47A1",
          color: "#fff",
          border: "none",
          borderRadius: "12px",
          fontSize: "14px",
          fontWeight: "700",
          fontFamily: "Inter, sans-serif",
          cursor: isSaving ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "background-color 0.15s",
          boxShadow: isSaving ? "none" : "0 2px 8px rgba(13,71,161,0.25)",
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

      {/* Status hint */}
      {configuredTerms > 0 && configuredTerms < periods.length && (
        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: "11px",
            color: "#6B7280",
            fontWeight: "500",
          }}
        >
          {periods.length - configuredTerms}{" "}
          {periods.length - configuredTerms === 1 ? "term" : "terms"} still need classes
        </p>
      )}
    </div>
  );
}
