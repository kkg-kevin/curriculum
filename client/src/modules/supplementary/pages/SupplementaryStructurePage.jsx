import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSupplementaryQuery, useUpdateSupplementaryStructure } from "../hooks/useSupplementary";
import { useSchoolQuery } from "../../schools/hooks/useSchool";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { SUPPLEMENTARY_TYPE_META } from "../schemas/supplementary.schema";

const CHIP_COLORS = ["#1D4ED8", "#16A34A", "#D97706", "#7C3AED"];

function CoursePill({ name, colorIdx, onRemove }) {
  const color = CHIP_COLORS[colorIdx % CHIP_COLORS.length];
  const [hov, setHov] = useState(false);
  return (
    <span onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", backgroundColor: hov ? "#F3F4F6" : "#F9FAFB", border: `1.5px solid ${color}22`, borderRadius: "20px", fontSize: "12px", fontWeight: "500", color, whiteSpace: "nowrap", transition: "all 0.1s" }}>
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#9CA3AF", fontSize: "13px", lineHeight: 1, display: "flex", alignItems: "center" }}>×</button>
      )}
    </span>
  );
}

function ClassRow({ grade, gradeIdx, onAddCourse, onRemoveCourse, onRemoveGrade }) {
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");

  const commit = () => {
    const t = input.trim();
    if (t) onAddCourse(t);
    setInput(""); setAdding(false);
  };

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: "12px", overflow: "hidden", marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", backgroundColor: "#F9FAFB", cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: grade.courses?.length > 0 ? "#16A34A" : "#D1D5DB", flexShrink: 0 }} />
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827", flex: 1 }}>{grade.name}</span>
        <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{grade.courses?.length || 0} course{grade.courses?.length !== 1 ? "s" : ""}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveGrade(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: "16px", lineHeight: 1, padding: "0 2px" }} title="Remove class">×</button>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", color: "#9CA3AF" }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {expanded && (
        <div style={{ padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {(grade.courses || []).map((c, ci) => (
            <CoursePill key={c.id} name={c.name} colorIdx={gradeIdx * 7 + ci} onRemove={() => onRemoveCourse(c.id)} />
          ))}
          {adding ? (
            <input autoFocus type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setAdding(false); setInput(""); } }}
              onBlur={commit} placeholder="Course name…"
              style={{ padding: "4px 10px", border: "1.5px dashed #16A34A", borderRadius: "20px", fontSize: "12px", fontFamily: "Inter, sans-serif", outline: "none", minWidth: "120px", backgroundColor: "#F0FDF4", color: "#111827" }} />
          ) : (
            <button type="button" onClick={(e) => { e.stopPropagation(); setAdding(true); }} style={{ padding: "4px 10px", border: "1.5px dashed #D1D5DB", borderRadius: "20px", fontSize: "12px", color: "#9CA3AF", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              + Add course
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PeriodEditor({ period, onUpdateGrades }) {
  const [addingGrade, setAddingGrade] = useState(false);
  const [gradeInput, setGradeInput] = useState("");
  const grades = period.grades || [];

  const addGrade = () => {
    const t = gradeInput.trim();
    if (!t) return;
    onUpdateGrades([...grades, { id: `g-${Date.now()}`, name: t, courses: [] }]);
    setGradeInput(""); setAddingGrade(false);
  };

  const addCourse = (gradeId, name) => onUpdateGrades(grades.map((g) => g.id === gradeId ? { ...g, courses: [...(g.courses || []), { id: `c-${Date.now()}`, name }] } : g));
  const removeCourse = (gradeId, cid) => onUpdateGrades(grades.map((g) => g.id === gradeId ? { ...g, courses: (g.courses || []).filter((c) => c.id !== cid) } : g));
  const removeGrade = (gradeId) => onUpdateGrades(grades.filter((g) => g.id !== gradeId));

  return (
    <div>
      {grades.map((grade, gi) => (
        <ClassRow key={grade.id} grade={grade} gradeIdx={gi}
          onAddCourse={(name) => addCourse(grade.id, name)}
          onRemoveCourse={(cid) => removeCourse(grade.id, cid)}
          onRemoveGrade={() => removeGrade(grade.id)} />
      ))}
      {addingGrade ? (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input autoFocus type="text" value={gradeInput} onChange={(e) => setGradeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGrade(); } if (e.key === "Escape") { setAddingGrade(false); setGradeInput(""); } }}
            placeholder="Class name, e.g. Grade 4A"
            style={{ flex: 1, padding: "9px 12px", border: "1.5px solid #93C5FD", borderRadius: "10px", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", backgroundColor: "#EFF6FF" }} />
          <button type="button" onClick={addGrade} style={{ padding: "9px 16px", backgroundColor: "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Add</button>
          <button type="button" onClick={() => { setAddingGrade(false); setGradeInput(""); }} style={{ padding: "9px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "10px", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAddingGrade(true)} style={{ width: "100%", padding: "10px", border: "1.5px dashed #D1D5DB", borderRadius: "10px", backgroundColor: "transparent", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer", textAlign: "center" }}>
          + Add class to this period
        </button>
      )}
    </div>
  );
}

function InlinePeriodAdd({ onAdd, hint }) {
  const [value, setValue] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const commit = () => { const t = value.trim(); if (t) onAdd(t); };

  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "16px" }}>
      <input ref={ref} type="text" value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        placeholder={hint || 'Period name, e.g. "Term 1" or "Semester A"'}
        style={{ flex: 1, padding: "11px 14px", border: "1.5px solid #93C5FD", borderRadius: "10px", fontSize: "14px", fontFamily: "Inter, sans-serif", outline: "none", backgroundColor: "#EFF6FF" }} />
      <button type="button" onClick={commit} style={{ padding: "11px 22px", backgroundColor: "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
        Add Period
      </button>
    </div>
  );
}

function BaseCurriculumPanel({ curriculum }) {
  const [openPeriod, setOpenPeriod] = useState(null);

  if (!curriculum) {
    return (
      <div style={{ padding: "12px", backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "10px" }}>
        <p style={{ margin: 0, fontSize: "12px", color: "#92400E", fontWeight: "600" }}>No base curriculum</p>
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#B45309", lineHeight: "1.5" }}>This school has no base curriculum assigned. Build the structure freely.</p>
      </div>
    );
  }

  const periods = curriculum.periods || [];
  const structure = curriculum.structure || [];

  if (periods.length === 0) {
    return (
      <div style={{ padding: "12px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px" }}>
        <p style={{ margin: 0, fontSize: "12px", color: "#374151", fontWeight: "600" }}>{curriculum.name}</p>
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9CA3AF" }}>No periods defined yet.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "600", color: "#374151" }}>{curriculum.name}</p>
      {periods.map((period, pi) => {
        const grades = structure[pi]?.grades || [];
        const isOpen = openPeriod === pi;
        return (
          <div key={pi} style={{ marginBottom: "5px", border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden" }}>
            <button type="button" onClick={() => setOpenPeriod(isOpen ? null : pi)}
              style={{ width: "100%", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isOpen ? "#EFF6FF" : "#F9FAFB", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: isOpen ? "#0D47A1" : "#374151" }}>{period.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{grades.length}cl</span>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.12s", flexShrink: 0 }}>
                  <path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
            {isOpen && (
              <div style={{ padding: "6px 10px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", gap: "3px" }}>
                {grades.length === 0
                  ? <span style={{ fontSize: "10px", color: "#9CA3AF" }}>No classes</span>
                  : grades.map((g) => (
                    <div key={g.id} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11px", color: "#374151" }}>{g.name}</span>
                      <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{g.courses?.length || 0}c</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SupplementaryStructurePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sup, isLoading } = useSupplementaryQuery(id);
  const { mutate: saveStructure, isPending: isSaving } = useUpdateSupplementaryStructure(id);

  const { data: school } = useSchoolQuery(sup?.schoolId);
  const { data: baseCurriculum } = useCurriculumQuery(school?.curriculumId);

  const [structure, setStructure] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [addingPeriod, setAddingPeriod] = useState(false);
  const [periodInput, setPeriodInput] = useState("");
  const [mirrorConfirm, setMirrorConfirm] = useState(false);

  const initialized = useRef(false);
  useEffect(() => {
    if (sup && !initialized.current) {
      initialized.current = true;
      const initial = sup.structure || [];
      setStructure(initial);
      if (initial.length > 0) setSelectedId(initial[0].id);
    }
  }, [sup]);

  const periods = structure || [];
  const typeMeta = sup ? SUPPLEMENTARY_TYPE_META[sup.type] : null;
  const activePeriod = periods.find((p) => p.id === selectedId);

  const addPeriod = (name) => {
    const newPeriod = { id: `p-${Date.now()}`, name, grades: [] };
    const next = [...periods, newPeriod];
    setStructure(next);
    setSelectedId(newPeriod.id);
    setDirty(true);
    setPeriodInput("");
    setAddingPeriod(false);
  };

  const removePeriod = (pid) => {
    const next = periods.filter((p) => p.id !== pid);
    setStructure(next);
    if (selectedId === pid) setSelectedId(next[0]?.id || null);
    setDirty(true);
  };

  const updateGrades = useCallback((pid, newGrades) => {
    setStructure((prev) => prev.map((p) => p.id === pid ? { ...p, grades: newGrades } : p));
    setDirty(true);
  }, []);

  const mirrorFromBase = useCallback(() => {
    if (!baseCurriculum) return;
    const basePeriodsList = baseCurriculum.periods || [];
    const baseStr = baseCurriculum.structure || [];
    const now = Date.now();
    const mirrored = basePeriodsList.map((p, pi) => ({
      id: `p-${now}-${pi}`,
      name: p.name,
      grades: (baseStr[pi]?.grades || []).map((g, gi) => ({
        id: `g-${now}-${pi}-${gi}`,
        name: g.name,
        courses: [],
      })),
    }));
    setStructure(mirrored);
    setSelectedId(mirrored[0]?.id || null);
    setDirty(true);
    setMirrorConfirm(false);
  }, [baseCurriculum]);

  if (isLoading || structure === null) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <div style={{ height: "60px", backgroundColor: "#EEF2F7", borderRadius: "12px", marginBottom: "20px" }} />
        <div style={{ display: "flex", gap: "20px" }}>
          {[210, "1fr", 200].map((w, i) => (
            <div key={i} style={{ width: typeof w === "number" ? w : undefined, flex: typeof w === "string" ? 1 : undefined, height: "400px", backgroundColor: "#F3F4F6", borderRadius: "16px" }} />
          ))}
        </div>
      </div>
    );
  }

  const totalClasses = periods.reduce((s, p) => s + (p.grades?.length || 0), 0);
  const totalCourses = periods.reduce((s, p) => s + (p.grades || []).reduce((gs, g) => gs + (g.courses?.length || 0), 0), 0);
  const basePeriodNames = baseCurriculum?.periods?.map((p) => p.name) || [];

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <button type="button" onClick={() => navigate("/supplementary")} style={{ background: "none", border: "none", padding: 0, color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>← Supplementary</button>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <button type="button" onClick={() => navigate(`/supplementary/${id}/view`)} style={{ background: "none", border: "none", padding: 0, color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>{sup?.name}</button>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Structure</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>{sup?.name}</h1>
            {typeMeta && (
              <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: typeMeta.bg, color: typeMeta.color, border: `1px solid ${typeMeta.border}`, textTransform: "uppercase" }}>
                {typeMeta.label}
              </span>
            )}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
            {sup?.schoolName}
            {baseCurriculum && <span style={{ color: "#9CA3AF" }}> · Base: {baseCurriculum.name}</span>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>

          {/* Mirror from base — shown only when base curriculum has periods */}
          {(baseCurriculum?.periods?.length > 0) && (
            mirrorConfirm ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px" }}>
                <span style={{ fontSize: "12px", color: "#1D4ED8", fontWeight: "600" }}>
                  {periods.length > 0 ? "Replace current structure?" : `Mirror ${baseCurriculum.periods.length} periods from base?`}
                </span>
                <button type="button" onClick={mirrorFromBase}
                  style={{ padding: "5px 12px", backgroundColor: "#0D47A1", color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                  Mirror
                </button>
                <button type="button" onClick={() => setMirrorConfirm(false)}
                  style={{ padding: "5px 10px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #D1D5DB", borderRadius: "7px", fontSize: "12px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setMirrorConfirm(true)}
                style={{ padding: "10px 16px", backgroundColor: "transparent", color: "#1D4ED8", border: "1.5px solid #BFDBFE", borderRadius: "10px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
                title={`Copy periods and classes from "${baseCurriculum.name}"`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Mirror base
              </button>
            )
          )}

          <button type="button" onClick={() => navigate(`/supplementary/${id}/view`)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Back</button>

          <button type="button" onClick={() => saveStructure(periods, { onSuccess: () => setDirty(false) })} disabled={isSaving || !dirty}
            style={{ padding: "10px 24px", backgroundColor: isSaving || !dirty ? "#93C5FD" : "#0D47A1", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isSaving || !dirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            {isSaving ? (<><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />Saving…</>) : dirty ? "Save Structure" : "Saved"}
          </button>

          {/* Type-aware next step */}
          {sup?.type === "substitutional" ? (
            <button type="button" onClick={() => navigate(`/supplementary/${id}/map`)} disabled={dirty}
              style={{ padding: "10px 20px", backgroundColor: dirty ? "#F3F4F6" : "#0D47A1", color: dirty ? "#9CA3AF" : "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: dirty ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
              Next: Map →
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <button type="button" onClick={() => navigate(`/supplementary/${id}/assign`)} disabled={dirty}
                style={{ padding: "10px 20px", backgroundColor: dirty ? "#F3F4F6" : "#0D47A1", color: dirty ? "#9CA3AF" : "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: dirty ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                Next: Assign →
              </button>
              {!dirty && (
                <button type="button" onClick={() => navigate(`/supplementary/${id}/map`)}
                  style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "11px", fontFamily: "Inter, sans-serif", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>
                  Map to periods first →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>

        {/* Left — supplementary periods list */}
        <div style={{ width: "210px", flexShrink: 0, position: "sticky", top: "24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Periods</p>
          </div>

          {periods.map((period, idx) => {
            const active = period.id === selectedId;
            const configured = (period.grades?.length || 0) > 0;
            return (
              <div key={period.id} style={{ position: "relative" }}>
                <button type="button" onClick={() => setSelectedId(period.id)}
                  style={{ width: "100%", padding: "11px 30px 11px 12px", backgroundColor: active ? "#EFF6FF" : "transparent", border: "none", borderLeft: `3px solid ${active ? "#0D47A1" : "transparent"}`, cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", transition: "all 0.12s", display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "6px", backgroundColor: configured ? "#16A34A" : "#F3F4F6", border: `1.5px solid ${configured ? "#16A34A" : "#E5E7EB"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {configured
                      ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <span style={{ fontSize: "9px", color: "#9CA3AF", fontWeight: "600" }}>{idx + 1}</span>}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: active ? "700" : "500", color: active ? "#0D47A1" : "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{period.name}</span>
                </button>
                <button type="button" onClick={() => removePeriod(period.id)} title="Remove period"
                  style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: "14px", lineHeight: 1, padding: "2px 4px", borderRadius: "4px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#D1D5DB"; }}>
                  ×
                </button>
              </div>
            );
          })}

          <div style={{ padding: "10px 12px", borderTop: periods.length > 0 ? "1px solid #F3F4F6" : "none" }}>
            {addingPeriod ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <input autoFocus type="text" value={periodInput} onChange={(e) => setPeriodInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); if (periodInput.trim()) addPeriod(periodInput.trim()); }
                    if (e.key === "Escape") { setAddingPeriod(false); setPeriodInput(""); }
                  }}
                  placeholder="e.g. Term 1"
                  style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #93C5FD", borderRadius: "8px", fontSize: "12px", fontFamily: "Inter, sans-serif", outline: "none", backgroundColor: "#EFF6FF", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: "4px" }}>
                  <button type="button" onClick={() => { if (periodInput.trim()) addPeriod(periodInput.trim()); }} style={{ flex: 1, padding: "6px", backgroundColor: "#0D47A1", color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Add</button>
                  <button type="button" onClick={() => { setAddingPeriod(false); setPeriodInput(""); }} style={{ padding: "6px 8px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "7px", fontSize: "12px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>✕</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingPeriod(true)} style={{ width: "100%", padding: "8px", border: "1.5px dashed #D1D5DB", borderRadius: "8px", backgroundColor: "transparent", color: "#9CA3AF", fontSize: "12px", fontFamily: "Inter, sans-serif", cursor: "pointer", textAlign: "center" }}>
                + Add period
              </button>
            )}
          </div>
        </div>

        {/* Center — period editor */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {periods.length === 0 ? (
            <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "40px 32px" }}>
              <div style={{ maxWidth: "480px", margin: "0 auto", textAlign: "center" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", border: "2px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="#1D4ED8" strokeWidth="2"/>
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="#1D4ED8" strokeWidth="2"/>
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="#93C5FD" strokeWidth="2"/>
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="#93C5FD" strokeWidth="2"/>
                  </svg>
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "#111827" }}>Add your first period</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.6" }}>
                  {basePeriodNames.length > 0
                    ? <>The base curriculum uses <strong>{basePeriodNames.join(", ")}</strong>. Mirror these or define your own periods for this supplementary curriculum.</>
                    : <>Periods are the top-level units — e.g. <strong>Term 1</strong>, <strong>Semester A</strong>.</>}
                </p>
                <InlinePeriodAdd onAdd={addPeriod} hint={basePeriodNames[0] ? `e.g. "${basePeriodNames[0]}"` : undefined} />
              </div>
            </div>
          ) : activePeriod ? (
            <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "12px", marginBottom: "16px" }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#1D4ED8" }}>{activePeriod.name}</p>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>
                  {activePeriod.grades?.length || 0} class{activePeriod.grades?.length !== 1 ? "es" : ""} · {(activePeriod.grades || []).reduce((s, g) => s + (g.courses?.length || 0), 0)} courses
                </span>
              </div>
              <PeriodEditor
                period={activePeriod}
                onUpdateGrades={(grades) => updateGrades(activePeriod.id, grades)}
              />
            </div>
          ) : (
            <div style={{ padding: "48px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "16px" }}>
              <p style={{ color: "#9CA3AF", fontSize: "14px" }}>Select a period from the left.</p>
            </div>
          )}
        </div>

        {/* Right — stats + base curriculum reference */}
        <div style={{ width: "200px", flexShrink: 0, position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "16px" }}>
            <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Overview</p>
            {[
              { label: "Periods",    value: periods.length },
              { label: "Configured", value: periods.filter((p) => (p.grades?.length || 0) > 0).length },
              { label: "Classes",    value: totalClasses },
              { label: "Courses",    value: totalCourses },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "16px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Base Reference</p>
            <BaseCurriculumPanel curriculum={baseCurriculum} />
          </div>
        </div>
      </div>
    </div>
  );
}
