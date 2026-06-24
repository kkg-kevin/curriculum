import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useBulkCreateClasses } from "../hooks/useClasses";

const ACCENT = "#0D47A1";
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(String);

export default function SetUpYearPanel({ school, curriculum, existingClasses, onClose }) {
  const navigate = useNavigate();
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const { mutate: bulkCreate, isPending } = useBulkCreateClasses();

  const gradeNames = curriculum?.classes || [];

  const existingKeySet = useMemo(() => {
    const s = new Set();
    for (const c of existingClasses) {
      s.add(`${(c.gradeName || "").trim().toLowerCase()}|${c.academicYear}`);
    }
    return s;
  }, [existingClasses]);

  const { toCreate, alreadyExistCount } = useMemo(() => {
    const toCreate = [];
    let alreadyExistCount = 0;
    for (const name of gradeNames) {
      if (existingKeySet.has(`${name.trim().toLowerCase()}|${year}`)) {
        alreadyExistCount++;
      } else {
        toCreate.push(name);
      }
    }
    return { toCreate, alreadyExistCount };
  }, [gradeNames, existingKeySet, year]);

  const handleGenerate = () => {
    const items = toCreate.map((gradeName) => ({
      schoolId:     school.id,
      curriculumId: school.curriculumId,
      gradeId:      `${school.curriculumId.slice(0, 8)}-${gradeName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      gradeName:    gradeName.trim(),
      academicYear: year,
      status:       "active",
      capacity:     null,
      classTeacherId: null,
    }));
    bulkCreate(items, { onSuccess: onClose });
  };

  const selectStyle = {
    padding: "6px 28px 6px 10px",
    borderRadius: 8,
    border: "1.5px solid #BFDBFE",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    color: "#111827",
    backgroundColor: "#fff",
    cursor: "pointer",
    outline: "none",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
  };

  return (
    <div style={{ padding: "20px 24px", backgroundColor: "#F8FAFF", borderBottom: existingClasses.length > 0 ? "1px solid #E5E7EB" : "none" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>
          Set up classes for <span style={{ color: ACCENT }}>{school.name}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}
        >
          ✕
        </button>
      </div>

      {!school.curriculumId || !curriculum ? (
        <div style={{ padding: "14px 16px", backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, fontSize: 13, color: "#92400E" }}>
          No curriculum is assigned to this school.{" "}
          <button
            type="button"
            onClick={() => navigate(`/schools/${school.id}/edit`)}
            style={{ background: "none", border: "none", color: ACCENT, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13, padding: 0 }}
          >
            Assign one →
          </button>
        </div>
      ) : gradeNames.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
          The curriculum &quot;{curriculum.name}&quot; has no grades defined. Add grades in the curriculum before setting up classes.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", whiteSpace: "nowrap" }}>Academic Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} style={selectStyle}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <span style={{ fontSize: 12, color: "#6B7280" }}>
              from <strong style={{ color: "#374151" }}>{curriculum.name}</strong>
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {gradeNames.map((name) => {
              const done = existingKeySet.has(`${name.trim().toLowerCase()}|${year}`);
              return (
                <span
                  key={name}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: done ? "#F3F4F6" : "#EFF6FF",
                    color: done ? "#9CA3AF" : ACCENT,
                    border: `1px solid ${done ? "#E5E7EB" : "#BFDBFE"}`,
                    textDecoration: done ? "line-through" : "none",
                  }}
                >
                  {name.trim()}
                </span>
              );
            })}
          </div>

          {toCreate.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
              All {gradeNames.length} classes for {year} are already set up.
            </p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "8px 18px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isPending}
                style={{ padding: "8px 18px", backgroundColor: isPending ? "#93C5FD" : ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                {isPending ? (
                  <><span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Generating…</>
                ) : (
                  `Generate ${toCreate.length} Class${toCreate.length !== 1 ? "es" : ""}`
                )}
              </button>
              {alreadyExistCount > 0 && (
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                  {alreadyExistCount} already exist for {year}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
