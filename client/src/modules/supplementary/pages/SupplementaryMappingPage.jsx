import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSupplementaryQuery, useUpdateSupplementaryMapping } from "../hooks/useSupplementary";
import { useSchoolQuery } from "../../schools/hooks/useSchool";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { SUPPLEMENTARY_TYPE_META } from "../schemas/supplementary.schema";

/* ─── helpers ─────────────────────────────────────────────────── */

function isPeriodReplaced(replacements, pi) {
  return replacements.some((r) => r.level === "period" && r.basePeriodIndex === pi);
}
function isGradeReplaced(replacements, pi, gid) {
  return replacements.some((r) => r.level === "grade" && r.basePeriodIndex === pi && r.baseGradeId === gid);
}
function isCourseReplaced(replacements, pi, gid, cid) {
  return replacements.some((r) => r.level === "course" && r.basePeriodIndex === pi && r.baseGradeId === gid && r.baseCourseId === cid);
}

function togglePeriod(replacements, period, pi) {
  if (isPeriodReplaced(replacements, pi)) {
    return replacements.filter((r) => !(r.basePeriodIndex === pi && r.level === "period"));
  }
  // remove any grade/course entries for this period (period-level overrides them)
  const cleaned = replacements.filter((r) => r.basePeriodIndex !== pi);
  return [...cleaned, { level: "period", basePeriodIndex: pi, basePeriodName: period.name }];
}

function toggleGrade(replacements, period, pi, grade) {
  if (isGradeReplaced(replacements, pi, grade.id)) {
    return replacements.filter((r) => !(r.level === "grade" && r.basePeriodIndex === pi && r.baseGradeId === grade.id));
  }
  // remove course-level entries for this grade (grade-level overrides them)
  const cleaned = replacements.filter((r) => !(r.level === "course" && r.basePeriodIndex === pi && r.baseGradeId === grade.id));
  return [...cleaned, { level: "grade", basePeriodIndex: pi, basePeriodName: period.name, baseGradeId: grade.id, baseGradeName: grade.name }];
}

function toggleCourse(replacements, period, pi, grade, course) {
  if (isCourseReplaced(replacements, pi, grade.id, course.id)) {
    return replacements.filter((r) => !(r.level === "course" && r.basePeriodIndex === pi && r.baseGradeId === grade.id && r.baseCourseId === course.id));
  }
  return [...replacements, { level: "course", basePeriodIndex: pi, basePeriodName: period.name, baseGradeId: grade.id, baseGradeName: grade.name, baseCourseId: course.id, baseCourseName: course.name }];
}

/* ─── Complementary period selector ───────────────────────────── */

function ComplementarySelector({ basePeriods, affectedPeriods, onChange }) {
  const toggle = (pi, pName) => {
    const exists = affectedPeriods.some((a) => a.basePeriodIndex === pi);
    if (exists) onChange(affectedPeriods.filter((a) => a.basePeriodIndex !== pi));
    else onChange([...affectedPeriods, { basePeriodIndex: pi, basePeriodName: pName }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {basePeriods.map((period, pi) => {
        const selected = affectedPeriods.some((a) => a.basePeriodIndex === pi);
        return (
          <button key={pi} type="button" onClick={() => toggle(pi, period.name)}
            style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", backgroundColor: selected ? "#F0FDF4" : "#ffffff", border: `2px solid ${selected ? "#16A34A" : "#E5E7EB"}`, borderRadius: "12px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", transition: "all 0.15s", width: "100%" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "6px", border: `2px solid ${selected ? "#16A34A" : "#D1D5DB"}`, backgroundColor: selected ? "#16A34A" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
              {selected && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: selected ? "700" : "600", color: selected ? "#14532D" : "#111827" }}>{period.name}</p>
              {period.startDate && (
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                  {new Date(period.startDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                  {" – "}
                  {new Date(period.endDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
            {selected && (
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#16A34A", backgroundColor: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "3px 8px", whiteSpace: "nowrap" }}>Running alongside</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Substitutional tree selector ────────────────────────────── */

function CourseRow({ course, isGradeLevel, periodReplaced, gradeReplaced, courseReplaced, onToggle }) {
  const disabled = periodReplaced || gradeReplaced;
  const checked = periodReplaced || gradeReplaced || courseReplaced;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 12px 7px 36px", opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={disabled ? undefined : onToggle}
        style={{ width: "14px", height: "14px", cursor: disabled ? "default" : "pointer", accentColor: "#D97706", flexShrink: 0 }} />
      <span style={{ fontSize: "12px", color: "#374151" }}>{course.name}</span>
      {courseReplaced && !disabled && (
        <span style={{ fontSize: "10px", color: "#D97706", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "6px", padding: "1px 6px" }}>replaced</span>
      )}
    </div>
  );
}

function GradeRow({ grade, pi, period, periodReplaced, replacements, onToggle, onToggleCourse }) {
  const [open, setOpen] = useState(false);
  const gradeReplaced = isGradeReplaced(replacements, pi, grade.id);
  const courses = grade.courses || [];
  const disabled = periodReplaced;
  const checked = periodReplaced || gradeReplaced;
  const hasAnyCourse = courses.some((c) => isCourseReplaced(replacements, pi, grade.id, c.id));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px 9px 20px", backgroundColor: gradeReplaced && !periodReplaced ? "#FFF9F0" : "transparent", opacity: disabled ? 0.5 : 1 }}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={disabled ? undefined : onToggle}
          style={{ width: "15px", height: "15px", cursor: disabled ? "default" : "pointer", accentColor: "#D97706", flexShrink: 0 }} />
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151", flex: 1 }}>{grade.name}</span>
        {gradeReplaced && !periodReplaced && (
          <span style={{ fontSize: "10px", color: "#D97706", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "6px", padding: "2px 7px" }}>class replaced</span>
        )}
        {!gradeReplaced && !periodReplaced && hasAnyCourse && (
          <span style={{ fontSize: "10px", color: "#9A3412", backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "6px", padding: "2px 7px" }}>partial</span>
        )}
        {!periodReplaced && !gradeReplaced && courses.length > 0 && (
          <button type="button" onClick={() => setOpen((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "11px", fontFamily: "Inter, sans-serif", padding: "0 4px" }}>
            {open ? "▲ courses" : "▼ courses"}
          </button>
        )}
      </div>
      {open && !periodReplaced && !gradeReplaced && courses.map((course) => (
        <CourseRow key={course.id} course={course} periodReplaced={periodReplaced} gradeReplaced={gradeReplaced}
          courseReplaced={isCourseReplaced(replacements, pi, grade.id, course.id)}
          onToggle={() => onToggleCourse(course)} />
      ))}
    </div>
  );
}

function SubstitutionalSelector({ basePeriods, baseStructure, replacements, onChange }) {
  const [openPeriods, setOpenPeriods] = useState({});

  const togglePeriodOpen = (pi) => setOpenPeriods((p) => ({ ...p, [pi]: !p[pi] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {basePeriods.map((period, pi) => {
        const pReplaced = isPeriodReplaced(replacements, pi);
        const grades = baseStructure[pi]?.grades || [];
        const isOpen = openPeriods[pi] ?? false;
        const gradeCount = grades.filter((g) => isGradeReplaced(replacements, pi, g.id)).length;
        const courseCount = grades.reduce((s, g) => s + (g.courses || []).filter((c) => isCourseReplaced(replacements, pi, g.id, c.id)).length, 0);
        const hasPartial = !pReplaced && (gradeCount > 0 || courseCount > 0);

        return (
          <div key={pi} style={{ border: `2px solid ${pReplaced ? "#D97706" : hasPartial ? "#FED7AA" : "#E5E7EB"}`, borderRadius: "12px", overflow: "hidden", backgroundColor: pReplaced ? "#FFFBEB" : "#ffffff" }}>
            {/* Period row */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px" }}>
              <input type="checkbox" checked={pReplaced} onChange={() => onChange(togglePeriod(replacements, period, pi))}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#D97706", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: pReplaced ? "#92400E" : "#111827" }}>{period.name}</p>
                {period.startDate && <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>{new Date(period.startDate).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })} – {new Date(period.endDate).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}</p>}
              </div>
              {pReplaced && <span style={{ fontSize: "11px", fontWeight: "700", color: "#D97706", backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "8px", padding: "3px 9px", whiteSpace: "nowrap" }}>Full term replaced</span>}
              {hasPartial && <span style={{ fontSize: "11px", fontWeight: "700", color: "#9A3412", backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "8px", padding: "3px 9px", whiteSpace: "nowrap" }}>Partial ({gradeCount > 0 ? `${gradeCount} class${gradeCount !== 1 ? "es" : ""}` : `${courseCount} course${courseCount !== 1 ? "s" : ""}` })</span>}
              {!pReplaced && grades.length > 0 && (
                <button type="button" onClick={() => togglePeriodOpen(pi)}
                  style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "5px 10px", cursor: "pointer", color: "#6B7280", fontSize: "12px", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>
                  {isOpen ? "▲ Hide" : "▼ Classes"}
                </button>
              )}
            </div>

            {/* Grade/course tree — only when period is NOT fully replaced */}
            {!pReplaced && isOpen && grades.length > 0 && (
              <div style={{ borderTop: "1px solid #F3F4F6", backgroundColor: "#FAFAFA" }}>
                {grades.map((grade) => (
                  <GradeRow key={grade.id} grade={grade} pi={pi} period={period}
                    periodReplaced={pReplaced} replacements={replacements}
                    onToggle={() => onChange(toggleGrade(replacements, period, pi, grade))}
                    onToggleCourse={(course) => onChange(toggleCourse(replacements, period, pi, grade, course))} />
                ))}
              </div>
            )}
            {!pReplaced && isOpen && grades.length === 0 && (
              <div style={{ borderTop: "1px solid #F3F4F6", padding: "10px 20px" }}>
                <span style={{ fontSize: "12px", color: "#9CA3AF" }}>No classes in this period of the base curriculum.</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Summary panel ────────────────────────────────────────────── */

function ComplementarySummary({ affectedPeriods, basePeriods }) {
  if (affectedPeriods.length === 0) return <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>No periods selected yet.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {affectedPeriods.sort((a, b) => a.basePeriodIndex - b.basePeriodIndex).map((a) => (
        <div key={a.basePeriodIndex} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#16A34A", flexShrink: 0 }} />
          <span style={{ fontSize: "12px", color: "#374151" }}>{a.basePeriodName}</span>
          <span style={{ fontSize: "10px", color: "#16A34A" }}>concurrent</span>
        </div>
      ))}
    </div>
  );
}

function SubstitutionalSummary({ replacements }) {
  if (replacements.length === 0) return <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>Nothing selected yet.</p>;
  const sorted = [...replacements].sort((a, b) => a.basePeriodIndex - b.basePeriodIndex || (a.level === "period" ? -1 : 1));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {sorted.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#D97706", flexShrink: 0, marginTop: "4px" }} />
          <div>
            <span style={{ fontSize: "11px", color: "#374151" }}>
              {r.level === "period" && <><strong>{r.basePeriodName}</strong> — full term</>}
              {r.level === "grade"  && <><strong>{r.basePeriodName}</strong> › {r.baseGradeName} — class</>}
              {r.level === "course" && <><strong>{r.basePeriodName}</strong> › {r.baseGradeName} › {r.baseCourseName}</>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────── */

export default function SupplementaryMappingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sup, isLoading } = useSupplementaryQuery(id);
  const { mutate: saveMapping, isPending: isSaving } = useUpdateSupplementaryMapping(id);

  const { data: school } = useSchoolQuery(sup?.schoolId);
  const { data: baseCurriculum } = useCurriculumQuery(school?.curriculumId);

  // local mapping state
  const [affectedPeriods, setAffectedPeriods] = useState([]);
  const [replacements, setReplacements]       = useState([]);
  const [dirty, setDirty] = useState(false);

  const initialized = useRef(false);
  useEffect(() => {
    if (sup && !initialized.current) {
      initialized.current = true;
      const m = sup.mapping || {};
      setAffectedPeriods(m.affectedPeriods || []);
      setReplacements(m.replacements || []);
    }
  }, [sup]);

  const handleSave = () => {
    const mapping = sup?.type === "complementary"
      ? { affectedPeriods }
      : { replacements };
    const onSuccess = () => {
      setDirty(false);
      navigate(sup?.type === "complementary" ? `/supplementary/${id}/assign` : `/supplementary/${id}/view`);
    };
    saveMapping(mapping, { onSuccess });
  };

  const basePeriods   = baseCurriculum?.periods   || [];
  const baseStructure = baseCurriculum?.structure  || [];
  const typeMeta      = sup ? SUPPLEMENTARY_TYPE_META[sup.type] : null;
  const isComplementary = sup?.type === "complementary";

  const hasMapped = isComplementary ? affectedPeriods.length > 0 : replacements.length > 0;

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <div style={{ height: "60px", backgroundColor: "#EEF2F7", borderRadius: "12px", marginBottom: "20px" }} />
        <div style={{ height: "400px", backgroundColor: "#F3F4F6", borderRadius: "16px" }} />
      </div>
    );
  }

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
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Map to Base</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Map to Base Curriculum</h1>
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
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={() => navigate(`/supplementary/${id}/structure`)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ← Structure
          </button>
          {isComplementary && (
            <button type="button" onClick={() => navigate(`/supplementary/${id}/assign`)}
              style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#6B7280", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
              Skip → Assign
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={isSaving || !hasMapped}
            style={{ padding: "10px 24px", backgroundColor: isSaving || !hasMapped ? "#93C5FD" : "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isSaving || !hasMapped ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            {isSaving ? (<><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />Saving…</>) : isComplementary ? "Save & Assign →" : "Save & Done →"}
          </button>
        </div>
      </div>

      {/* No base curriculum warning */}
      {!baseCurriculum && (
        <div style={{ padding: "16px 20px", backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "12px", marginBottom: "20px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#92400E" }}>
            <strong>No base curriculum assigned to {sup?.schoolName}.</strong> Assign a curriculum to this school first so you can map this supplementary curriculum against it.
          </p>
          <button type="button" onClick={() => navigate(`/schools/${sup?.schoolId}/edit`)} style={{ marginTop: "8px", padding: "7px 16px", backgroundColor: "#D97706", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Go to school settings →
          </button>
        </div>
      )}

      {baseCurriculum && basePeriods.length === 0 && (
        <div style={{ padding: "16px 20px", backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "12px", marginBottom: "20px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#92400E" }}>The base curriculum <strong>{baseCurriculum.name}</strong> has no periods defined yet. Add periods to the base curriculum to enable mapping.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>

        {/* Main selector */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Instruction card */}
          <div style={{ padding: "16px 20px", backgroundColor: typeMeta?.bg, border: `1px solid ${typeMeta?.border}`, borderRadius: "14px", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>
              {isComplementary
                ? <><strong>Select which base curriculum terms <em>{sup?.name}</em> runs alongside.</strong> Both will be active concurrently for the school during those periods.</>
                : <><strong>Select what <em>{sup?.name}</em> replaces in the base curriculum.</strong> Check a full term to replace it entirely, expand a term to replace specific classes, or expand a class to replace individual courses.</>}
            </p>
          </div>

          {basePeriods.length > 0 && (
            isComplementary
              ? <ComplementarySelector basePeriods={basePeriods} affectedPeriods={affectedPeriods} onChange={(v) => { setAffectedPeriods(v); setDirty(true); }} />
              : <SubstitutionalSelector basePeriods={basePeriods} baseStructure={baseStructure} replacements={replacements} onChange={(v) => { setReplacements(v); setDirty(true); }} />
          )}
        </div>

        {/* Summary panel */}
        <div style={{ width: "220px", flexShrink: 0, position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "16px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isComplementary ? "Running alongside" : "Replacements"}
            </p>
            {isComplementary
              ? <ComplementarySummary affectedPeriods={affectedPeriods} basePeriods={basePeriods} />
              : <SubstitutionalSummary replacements={replacements} />}
          </div>

          {!isComplementary && (
            <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "14px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Levels</p>
              {[
                { label: "Full term", desc: "Replace all classes and courses in that term", color: "#D97706" },
                { label: "Class", desc: "Replace one grade across all its courses", color: "#9A3412" },
                { label: "Course", desc: "Replace a single course within a grade", color: "#6B7280" },
              ].map(({ label, desc, color }) => (
                <div key={label} style={{ marginBottom: "8px" }}>
                  <p style={{ margin: "0 0 2px", fontSize: "11px", fontWeight: "700", color }}>{label}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF", lineHeight: "1.4" }}>{desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
