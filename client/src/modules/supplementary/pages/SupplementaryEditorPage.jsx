import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSupplementaryQuery, useUpdateSupplementaryGrades } from "../hooks/useSupplementary";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { SUPPLEMENTARY_TYPE_META } from "../schemas/supplementary.schema";
import Breadcrumbs from "../../../components/ui/Breadcrumbs";

/* ── helpers ─────────────────────────────────────────────── */

function genId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ── Course pill ─────────────────────────────────────────── */

function CoursePill({ name, onRemove, color }) {
  const [hov, setHov] = useState(false);
  return (
    <span onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", backgroundColor: hov ? "#F3F4F6" : "#F9FAFB", border: `1.5px solid ${color}33`, borderRadius: "20px", fontSize: "12px", fontWeight: "500", color, whiteSpace: "nowrap", transition: "all 0.1s" }}>
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#9CA3AF", fontSize: "13px", lineHeight: 1, display: "flex", alignItems: "center" }}>×</button>
      )}
    </span>
  );
}

/* ── Base course pill (read-only) ─────────────────────────── */

function BasePill({ name }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "20px", fontSize: "12px", fontWeight: "500", color: "#6B7280", whiteSpace: "nowrap" }}>
      {name}
    </span>
  );
}

/* ── Grade row ───────────────────────────────────────────── */

function GradeRow({ grade, supGrade, type, onUpdateCourses }) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const meta = SUPPLEMENTARY_TYPE_META[type];

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const baseCourses = grade.courses || [];
  const supCourses = supGrade?.courses || [];

  const commit = () => {
    const t = input.trim();
    if (t) onUpdateCourses([...supCourses, { id: genId(), name: t }]);
    setInput(""); setAdding(false);
  };

  const removeCourse = (id) => onUpdateCourses(supCourses.filter((c) => c.id !== id));

  const isComplementary = type === "complementary";
  const hasSupCourses = supCourses.length > 0;

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: "12px", overflow: "hidden", marginBottom: "8px" }}>
      {/* Grade header */}
      <div style={{ padding: "10px 14px", backgroundColor: "#F9FAFB", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: hasSupCourses ? meta.color : "#D1D5DB", flexShrink: 0 }} />
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{grade.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
            {baseCourses.length} base · {supCourses.length} {isComplementary ? "added" : "replacement"}
          </span>
        </div>
      </div>

      <div style={{ padding: "12px 14px" }}>
        {/* Base courses */}
        {baseCourses.length > 0 && (
          <div style={{ marginBottom: "10px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {isComplementary ? "Base courses (kept)" : "Base courses (replaced)"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {baseCourses.map((c) => (
                <BasePill key={c.id} name={c.name} />
              ))}
            </div>
          </div>
        )}
        {baseCourses.length === 0 && (
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No base courses in this grade for this term.</p>
        )}

        {/* Divider with label */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: meta.border }} />
          <span style={{ fontSize: "10px", fontWeight: "700", color: meta.color, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
            {isComplementary ? "+ Complementary courses" : "↻ Replacement courses"}
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: meta.border }} />
        </div>

        {/* Supplementary courses */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {supCourses.map((c) => (
            <CoursePill key={c.id} name={c.name} color={meta.color} onRemove={() => removeCourse(c.id)} />
          ))}

          {adding ? (
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setAdding(false); setInput(""); } }}
              onBlur={commit}
              placeholder="Course name…"
              style={{ padding: "4px 10px", border: `1.5px dashed ${meta.color}`, borderRadius: "20px", fontSize: "12px", fontFamily: "Inter, sans-serif", outline: "none", minWidth: "120px", backgroundColor: meta.bg, color: "#111827" }} />
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              style={{ padding: "4px 10px", border: `1.5px dashed ${meta.border}`, borderRadius: "20px", fontSize: "12px", color: meta.color, background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: "600" }}>
              + Add course
            </button>
          )}
        </div>

        {supCourses.length === 0 && !adding && (
          <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#D1D5DB", fontStyle: "italic" }}>
            {isComplementary ? "No supplementary courses added yet." : "No replacement courses added yet — base courses still apply."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */

export default function SupplementaryEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sup, isLoading } = useSupplementaryQuery(id);
  const { mutate: saveGrades, isPending: isSaving } = useUpdateSupplementaryGrades(id);
  const { data: baseCurriculum } = useCurriculumQuery(sup?.baseCurriculumId);

  const [grades, setGrades] = useState(null);
  const [dirty, setDirty] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (sup && !initialized.current) {
      initialized.current = true;
      setGrades(sup.grades || []);
    }
  }, [sup]);

  const updateCourses = useCallback((gradeId, gradeName, courses) => {
    setGrades((prev) => {
      const existing = prev.find((g) => g.gradeId === gradeId);
      if (existing) {
        return prev.map((g) => g.gradeId === gradeId ? { ...g, courses } : g);
      }
      return [...prev, { gradeId, gradeName, courses }];
    });
    setDirty(true);
  }, []);

  const handleSave = () => {
    saveGrades(grades, {
      onSuccess: () => {
        setDirty(false);
        navigate(`/supplementary/${id}/view`);
      },
    });
  };

  if (isLoading || grades === null) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <div style={{ height: "60px", backgroundColor: "#EEF2F7", borderRadius: "12px", marginBottom: "20px" }} />
        <div style={{ display: "flex", gap: "20px" }}>
          <div style={{ flex: 1, height: "400px", backgroundColor: "#F3F4F6", borderRadius: "16px" }} />
          <div style={{ width: "200px", height: "200px", backgroundColor: "#F3F4F6", borderRadius: "16px" }} />
        </div>
      </div>
    );
  }

  const typeMeta = SUPPLEMENTARY_TYPE_META[sup?.type] || {};
  const termGrades = baseCurriculum?.structure?.[sup?.termIndex]?.grades || [];

  const totalSupCourses = grades.reduce((s, g) => s + (g.courses?.length || 0), 0);
  const gradesWithCourses = grades.filter((g) => g.courses?.length > 0).length;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", gap: "16px" }}>
        <div>
          <Breadcrumbs items={[
            { label: "← Supplementary", to: "/supplementary" },
            { label: sup?.name, to: `/supplementary/${id}/view` },
            { label: "Edit Courses" },
          ]} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>{sup?.name}</h1>
            <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: typeMeta.bg, color: typeMeta.color, border: `1px solid ${typeMeta.border}`, textTransform: "uppercase" }}>
              {typeMeta.label}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
            {sup?.schoolName} · <strong>{sup?.termName}</strong>
            {baseCurriculum && <span style={{ color: "#9CA3AF" }}> · Base: {baseCurriculum.name}</span>}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
          <button type="button" onClick={() => navigate(`/supplementary/${id}/view`)}
            style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Back
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving || !dirty}
            style={{ padding: "10px 24px", backgroundColor: isSaving || !dirty ? "#93C5FD" : "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isSaving || !dirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            {isSaving
              ? <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />Saving…</>
              : "Save"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>

        {/* Main editor */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {termGrades.length === 0 ? (
            <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "40px 32px", textAlign: "center" }}>
              <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No grades in {sup?.termName}</p>
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
                The base curriculum has no grades set up for {sup?.termName} yet. Add grades to the base curriculum structure first.
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "20px 24px" }}>
              {/* Type instruction banner */}
              <div style={{ padding: "12px 16px", backgroundColor: typeMeta.bg, border: `1px solid ${typeMeta.border}`, borderRadius: "10px", marginBottom: "16px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>
                  {sup?.type === "complementary"
                    ? <><strong>Complementary:</strong> Add extra courses per grade. Students will take both the base courses and the courses you add here, running at the same time during {sup?.termName}.</>
                    : <><strong>Substitutional:</strong> Add replacement courses per grade. Students will take these courses <em>instead of</em> the base courses during {sup?.termName}.</>}
                </p>
              </div>

              {termGrades.map((grade) => {
                const supGrade = grades.find((g) => g.gradeId === grade.id);
                return (
                  <GradeRow
                    key={grade.id}
                    grade={grade}
                    supGrade={supGrade}
                    type={sup?.type}
                    onUpdateCourses={(courses) => updateCourses(grade.id, grade.name, courses)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Right summary panel */}
        <div style={{ width: "200px", flexShrink: 0, position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "16px" }}>
            <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Overview</p>
            {[
              { label: "Term",    value: sup?.termName },
              { label: "Grades",  value: termGrades.length },
              { label: "Configured", value: `${gradesWithCourses} / ${termGrades.length}` },
              { label: sup?.type === "complementary" ? "Added" : "Replacements", value: totalSupCourses },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: "12px 14px", backgroundColor: typeMeta.bg, border: `1px solid ${typeMeta.border}`, borderRadius: "12px" }}>
            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: typeMeta.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{typeMeta.label}</p>
            <p style={{ margin: 0, fontSize: "11px", color: "#374151", lineHeight: "1.5" }}>
              {sup?.type === "complementary"
                ? "Base courses are kept. Students do both."
                : "Base courses are replaced. Students do only the new courses."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
