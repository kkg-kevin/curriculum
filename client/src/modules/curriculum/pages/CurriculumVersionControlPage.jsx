import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import { useAcademicYears } from "../hooks/useAcademicYear";
import { useCurriculumVersions, useCreateCurriculumVersion } from "../hooks/useCurriculumVersion";

/* ── Constants ─────────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Academic Year" },
  { n: 4, label: "Version Control" },
];

const STATUSES = [
  { value: "draft",    label: "Draft",    bg: "#FFFBEB", border: "#FCD34D", color: "#92400E", dot: "#F59E0B" },
  { value: "inactive", label: "Inactive", bg: "#F9FAFB", border: "#E5E7EB", color: "#6B7280", dot: "#9CA3AF" },
];

/* ── CSS ───────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }

  .vc-steps { display:flex; align-items:center; justify-content:center; margin-bottom:28px; }
  .vc-connector { width:60px; }
  @media (max-width:600px) { .vc-connector { width:28px; } .vc-steps { justify-content:flex-start; overflow-x:auto; padding-bottom:4px; } }

  .vc-layout { display:grid; grid-template-columns:1fr 272px; gap:20px; align-items:start; }
  @media (max-width:900px) { .vc-layout { grid-template-columns:1fr; } }

  .vc-period-tabs { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; margin-bottom:18px; }
  .vc-tab {
    padding:7px 14px; border-radius:8px; border:1.5px solid #E5E7EB;
    background:#fff; font-size:12px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; white-space:nowrap; transition:all 0.15s; color:#6B7280;
  }
  .vc-tab:hover { border-color:#93C5FD; color:#1D4ED8; }
  .vc-tab.active { border-color:#0D47A1; background:#EFF6FF; color:#0D47A1; }

  .vc-class-row {
    display:flex; align-items:flex-start; gap:12px; padding:11px 0;
    border-bottom:1px solid #F3F4F6;
  }
  .vc-class-row:last-child { border-bottom:none; }
  .vc-class-name {
    width:110px; flex-shrink:0; font-size:12px; font-weight:600;
    color:#374151; padding-top:3px; line-height:1.4;
  }
  .vc-chips { display:flex; flex-wrap:wrap; gap:5px; flex:1; align-items:center; }

  .vc-chip {
    display:inline-flex; align-items:center; gap:4px;
    padding:4px 9px; border-radius:20px; font-size:11px; font-weight:600;
    background:#EFF6FF; border:1.5px solid #BFDBFE; color:#1E3A8A;
    font-family:Inter,sans-serif;
  }
  .vc-chip-remove {
    width:13px; height:13px; border-radius:50%; border:none;
    background:rgba(29,58,138,0.1); color:#1E3A8A; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    font-size:10px; font-weight:700; padding:0; line-height:1; transition:background 0.1s;
  }
  .vc-chip-remove:hover { background:rgba(239,68,68,0.15); color:#EF4444; }

  .vc-add-btn {
    display:inline-flex; align-items:center; gap:3px;
    padding:4px 9px; border-radius:20px; font-size:11px; font-weight:600;
    background:transparent; border:1.5px dashed #D1D5DB; color:#9CA3AF;
    font-family:Inter,sans-serif; cursor:pointer; transition:all 0.15s;
  }
  .vc-add-btn:hover { border-color:#0D47A1; color:#0D47A1; background:#EFF6FF; }

  .vc-inline-form {
    display:flex; gap:8px; align-items:center; flex-wrap:wrap;
    padding:9px 12px; background:#F8FAFF; border-radius:10px;
    border:1.5px solid #E8F0FE; margin-top:6px; animation:fadeIn 0.15s ease;
  }
  .vc-inline-input {
    padding:6px 10px; border-radius:7px; border:1.5px solid #E5E7EB;
    font-size:12px; font-family:Inter,sans-serif; background:#fff; outline:none;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .vc-inline-input:focus { border-color:#0D47A1; box-shadow:0 0 0 3px rgba(13,71,161,0.1); }
  .vc-inline-input.name { width:150px; }
  .vc-inline-input.code { width:80px; }

  .vc-empty {
    text-align:center; padding:60px 24px; background:#FAFAFA;
    border:2px dashed #E5E7EB; border-radius:16px;
  }

  .vc-status-btn {
    flex:1; padding:7px 8px; border-radius:8px; border:1.5px solid #E5E7EB;
    background:#fff; font-size:12px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; text-align:center; transition:all 0.15s; min-width:72px;
  }
  .vc-status-btn:hover:not(:disabled) { border-color:#93C5FD; }
  .vc-status-btn.sel-draft    { border-color:#FCD34D; background:#FFFBEB; color:#92400E; }
  .vc-status-btn.sel-inactive { border-color:#D1D5DB; background:#F3F4F6; color:#6B7280; }

  .vc-btn-primary {
    padding:7px 16px; background:#0D47A1; color:#fff; border:none; border-radius:8px;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer;
    display:inline-flex; align-items:center; gap:6px; transition:background 0.15s;
  }
  .vc-btn-primary:disabled { background:#93C5FD; cursor:not-allowed; }
  .vc-btn-primary:not(:disabled):hover { background:#0A3880; }

  .vc-btn-secondary {
    padding:7px 14px; background:transparent; color:#374151;
    border:1.5px solid #E5E7EB; border-radius:8px; font-size:13px; font-weight:600;
    font-family:Inter,sans-serif; cursor:pointer; transition:all 0.15s;
  }
  .vc-btn-secondary:hover { background:#F9FAFB; }

  .vc-btn-ghost {
    padding:7px 14px; background:#EFF6FF; color:#1D4ED8;
    border:1.5px solid #BFDBFE; border-radius:8px; font-size:13px; font-weight:600;
    font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s;
  }
  .vc-btn-ghost:hover { background:#DBEAFE; }

  .vc-btn-restore {
    padding:7px 14px; background:#F0FDF4; color:#15803D;
    border:1.5px solid #BBF7D0; border-radius:8px; font-size:13px; font-weight:600;
    font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s;
  }
  .vc-btn-restore:hover { background:#DCFCE7; }
  .vc-btn-restore:disabled { opacity:0.5; cursor:not-allowed; }

  /* History sidebar */
  .vc-sidebar {
    background:#fff; border-radius:16px; border:1.5px solid #E5E7EB;
    box-shadow:0 1px 4px rgba(0,0,0,0.04); overflow:hidden;
    position:sticky; top:20px;
  }
  .vc-sidebar-header { padding:14px 16px; border-bottom:1px solid #F3F4F6; }

  .vc-history-entry {
    width:100%; padding:12px 16px; border-bottom:1px solid #F3F4F6;
    cursor:pointer; transition:background 0.12s; display:block; text-align:left;
    background:none; border-left:3px solid transparent;
    font-family:Inter,sans-serif; border-right:none; border-top:none;
  }
  .vc-history-entry:last-child { border-bottom:none; }
  .vc-history-entry:hover { background:#F9FAFB; }
  .vc-history-entry.is-current { border-left-color:#0D47A1; background:#F8FAFF; }
  .vc-history-entry.is-viewing { background:#FFFBEB; border-left-color:#F59E0B; }
`;

/* ── Shared style object ───────────────────────────────────────────────── */

const card = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  padding: "20px 22px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const genId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function scaffoldBlank(curriculum) {
  const gradesMap = new Map();
  (curriculum.structure || []).forEach((term) => {
    (term.grades || []).forEach((g) => {
      const key = g.id || g.name;
      if (key && !gradesMap.has(key)) gradesMap.set(key, g.name || g);
    });
  });
  let gradeNames = [...gradesMap.values()];
  if (gradeNames.length === 0) gradeNames = curriculum.classes || [];

  return (curriculum.periods || []).map((p) => ({
    periodName: p.name,
    classes: gradeNames.map((name) => ({ className: name, courses: [] })),
  }));
}

function scaffoldFromExisting(curriculum, existingContent) {
  const gradesMap = new Map();
  (curriculum.structure || []).forEach((term) => {
    (term.grades || []).forEach((g) => {
      const key = g.id || g.name;
      if (key && !gradesMap.has(key)) gradesMap.set(key, g.name || g);
    });
  });
  let gradeNames = [...gradesMap.values()];
  if (gradeNames.length === 0) gradeNames = curriculum.classes || [];

  return (curriculum.periods || []).map((p) => {
    const existingPeriod = (existingContent || []).find((ep) => ep.periodName === p.name);
    return {
      periodName: p.name,
      classes: gradeNames.map((name) => {
        const existingClass = existingPeriod?.classes?.find((c) => c.className === name);
        return { className: name, courses: existingClass?.courses || [] };
      }),
    };
  });
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ── Spinner ───────────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
  );
}

function SpinnerPage() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "360px", fontFamily: "Inter,sans-serif", gap: "14px", color: "#6B7280", fontSize: "14px" }}>
      <span style={{ width: "26px", height: "26px", border: "3px solid #E5E7EB", borderTopColor: "#0D47A1", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
      Loading…
    </div>
  );
}

/* ── StatusDot ─────────────────────────────────────────────────────────── */

function StatusDot({ status }) {
  const s = STATUSES.find((x) => x.value === status) || STATUSES[0];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", backgroundColor: s.bg, border: `1.5px solid ${s.border}`, color: s.color, fontSize: "11px", fontWeight: "700" }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

/* ── StepIndicator ─────────────────────────────────────────────────────── */

function StepIndicator({ current }) {
  return (
    <div className="vc-steps">
      {STEPS.map((step, i) => {
        const done = step.n < current, active = step.n === current;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", backgroundColor: done || active ? "#0D47A1" : "#F3F4F6", border: `2px solid ${done || active ? "#0D47A1" : "#E5E7EB"}`, display: "flex", alignItems: "center", justifyContent: "center", color: done || active ? "#fff" : "#9CA3AF", fontSize: done ? "15px" : "13px", fontWeight: "700", flexShrink: 0 }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{ fontSize: "11px", fontWeight: active ? "600" : "400", color: active ? "#0D47A1" : done ? "#374151" : "#9CA3AF", whiteSpace: "nowrap" }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="vc-connector" style={{ height: "2px", backgroundColor: done ? "#0D47A1" : "#E5E7EB", margin: "0 6px", marginBottom: "20px", flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── PeriodTabs ────────────────────────────────────────────────────────── */

function PeriodTabs({ periods, ayPeriods, activeIdx, onChange }) {
  return (
    <div className="vc-period-tabs">
      {periods.map((p, i) => {
        const ayp = ayPeriods.find((ap) => ap.name === p.name);
        const dates =
          ayp?.startDate || ayp?.endDate
            ? `${fmtDate(ayp.startDate)} – ${fmtDate(ayp.endDate)}`
            : null;
        return (
          <button key={p.name} type="button" onClick={() => onChange(i)} className={`vc-tab${activeIdx === i ? " active" : ""}`}>
            {p.name}
            {dates && (
              <span style={{ fontSize: "10px", fontWeight: "400", marginLeft: "5px", opacity: 0.7 }}>{dates}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── InlineAddForm ─────────────────────────────────────────────────────── */

function InlineAddForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ id: genId(), name: name.trim(), code: code.trim() });
    setName("");
    setCode("");
  };

  return (
    <form className="vc-inline-form" onSubmit={submit}>
      <input ref={nameRef} className="vc-inline-input name" placeholder="Course name *" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="vc-inline-input code" placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} />
      <button type="submit" disabled={!name.trim()} style={{ padding: "5px 11px", background: "#0D47A1", color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", fontWeight: "700", fontFamily: "Inter,sans-serif", cursor: name.trim() ? "pointer" : "not-allowed", opacity: name.trim() ? 1 : 0.5 }}>
        Add
      </button>
      <button type="button" onClick={onCancel} style={{ padding: "5px 9px", background: "transparent", color: "#9CA3AF", border: "1.5px solid #E5E7EB", borderRadius: "7px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter,sans-serif", cursor: "pointer" }}>
        Cancel
      </button>
    </form>
  );
}

/* ── CourseMatrixView (read-only) ──────────────────────────────────────── */

function CourseMatrixView({ content, activeTab }) {
  const periodContent = content[activeTab] || null;
  if (!periodContent) return <p style={{ color: "#9CA3AF", fontSize: "13px", margin: 0 }}>No data for this period.</p>;
  if (!periodContent.classes?.length)
    return <p style={{ color: "#D1D5DB", fontSize: "13px", fontStyle: "italic", margin: 0 }}>No grades configured in structure.</p>;

  return (
    <div>
      {periodContent.classes.map((cls) => (
        <div key={cls.className} className="vc-class-row">
          <div className="vc-class-name">{cls.className}</div>
          <div className="vc-chips">
            {cls.courses.length === 0 ? (
              <span style={{ fontSize: "11px", color: "#D1D5DB", fontStyle: "italic" }}>No courses</span>
            ) : (
              cls.courses.map((c) => (
                <span key={c.id} className="vc-chip">
                  {c.name}
                  {c.code ? <span style={{ opacity: 0.6, fontWeight: "400" }}> · {c.code}</span> : null}
                </span>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── CourseMatrixEdit ──────────────────────────────────────────────────── */

function CourseMatrixEdit({ content, activeTab, onUpdate }) {
  const [addingFor, setAddingFor] = useState(null);

  useEffect(() => { setAddingFor(null); }, [activeTab]);

  const periodContent = content[activeTab] || null;
  if (!periodContent) return null;
  if (!periodContent.classes?.length)
    return <p style={{ color: "#D1D5DB", fontSize: "13px", fontStyle: "italic", margin: 0 }}>No grades configured. Go to Structure to add grade levels first.</p>;

  const removeCourse = (classIdx, courseId) => {
    const next = deepClone(content);
    next[activeTab].classes[classIdx].courses = next[activeTab].classes[classIdx].courses.filter((c) => c.id !== courseId);
    onUpdate(next);
  };

  const addCourse = (classIdx, course) => {
    const next = deepClone(content);
    next[activeTab].classes[classIdx].courses.push(course);
    onUpdate(next);
    setAddingFor(null);
  };

  return (
    <div>
      {periodContent.classes.map((cls, classIdx) => (
        <div key={cls.className} style={{ paddingBottom: "2px" }}>
          <div className="vc-class-row">
            <div className="vc-class-name">{cls.className}</div>
            <div className="vc-chips">
              {cls.courses.map((c) => (
                <span key={c.id} className="vc-chip">
                  {c.name}
                  {c.code ? <span style={{ opacity: 0.6, fontWeight: "400" }}> · {c.code}</span> : null}
                  <button type="button" className="vc-chip-remove" onClick={() => removeCourse(classIdx, c.id)} title="Remove">×</button>
                </span>
              ))}
              {addingFor !== classIdx && (
                <button type="button" className="vc-add-btn" onClick={() => setAddingFor(classIdx)}>
                  <span style={{ fontSize: "13px", lineHeight: 1 }}>+</span> Add course
                </button>
              )}
            </div>
          </div>
          {addingFor === classIdx && (
            <div style={{ paddingLeft: "122px" }}>
              <InlineAddForm onAdd={(c) => addCourse(classIdx, c)} onCancel={() => setAddingFor(null)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── VersionHistorySidebar ─────────────────────────────────────────────── */

function VersionHistorySidebar({ current, history, mode, viewingId, onSelectHistory, onViewCurrent }) {
  const allVersions = [
    ...(current ? [{ ...current, _isCurrent: true }] : []),
    ...history,
  ];

  return (
    <div className="vc-sidebar">
      <div className="vc-sidebar-header">
        <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>Version History</p>
        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
          {allVersions.length} {allVersions.length === 1 ? "version" : "versions"}
        </p>
      </div>

      {allVersions.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>No versions yet.</p>
        </div>
      ) : (
        <div style={{ maxHeight: "480px", overflowY: "auto" }}>
          {allVersions.map((v) => {
            const isCurrent = !!v._isCurrent;
            const isViewing = mode === "history" && v.id === viewingId;
            const cls = `vc-history-entry${isCurrent ? " is-current" : ""}${isViewing ? " is-viewing" : ""}`;
            return (
              <button
                key={v.id}
                type="button"
                className={cls}
                onClick={() => (isCurrent ? onViewCurrent() : onSelectHistory(v))}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                    Version {v.versionNumber}
                  </span>
                  <StatusDot status={v.status} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{fmtDate(v.createdAt)}</span>
                  {isCurrent && (
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "#0D47A1", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "20px", padding: "1px 7px" }}>
                      CURRENT
                    </span>
                  )}
                  {isViewing && (
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "20px", padding: "1px 7px" }}>
                      VIEWING
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── CurrentVersionPanel ───────────────────────────────────────────────── */

function CurrentVersionPanel({ version, curriculumPeriods, ayPeriods, nextVersionNumber, onNew, onEdit }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0F2645" }}>
                Version {version.versionNumber}
              </h2>
              <StatusDot status={version.status} />
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>Saved {fmtDate(version.createdAt)}</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button type="button" className="vc-btn-ghost" onClick={onEdit}>
              Edit → v{nextVersionNumber}
            </button>
            <button type="button" className="vc-btn-primary" onClick={onNew}>
              + New Version
            </button>
          </div>
        </div>
      </div>

      {/* Course matrix */}
      <div style={card}>
        {curriculumPeriods.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>
            No periods configured in structure.
          </p>
        ) : (
          <>
            <PeriodTabs periods={curriculumPeriods} ayPeriods={ayPeriods} activeIdx={activeTab} onChange={setActiveTab} />
            <CourseMatrixView content={version.content || []} activeTab={activeTab} />
          </>
        )}
      </div>
    </div>
  );
}

/* ── HistoricalVersionPanel ────────────────────────────────────────────── */

function HistoricalVersionPanel({ version, curriculumPeriods, ayPeriods, nextVersionNumber, onRestore, isPending, onBack }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{ ...card, backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#92400E" }}>
                Version {version.versionNumber}
              </h2>
              <StatusDot status={version.status} />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#92400E", backgroundColor: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "20px", padding: "2px 8px" }}>
                Historical
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#B45309" }}>Saved {fmtDate(version.createdAt)}</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button type="button" className="vc-btn-secondary" onClick={onBack}>
              ← Current
            </button>
            <button type="button" className="vc-btn-restore" onClick={onRestore} disabled={isPending}>
              {isPending ? <><Spinner /> Restoring…</> : `Restore as v${nextVersionNumber}`}
            </button>
          </div>
        </div>
      </div>

      {/* Course matrix (read-only) */}
      <div style={card}>
        {curriculumPeriods.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>
            No periods configured.
          </p>
        ) : (
          <>
            <PeriodTabs periods={curriculumPeriods} ayPeriods={ayPeriods} activeIdx={activeTab} onChange={setActiveTab} />
            <CourseMatrixView content={version.content || []} activeTab={activeTab} />
          </>
        )}
      </div>
    </div>
  );
}

/* ── VersionEditorPanel (new or edit) ──────────────────────────────────── */

function VersionEditorPanel({ type, curriculum, ayPeriods, initialContent, nextVersionNumber, onSave, onCancel, isPending }) {
  const [activeTab, setActiveTab] = useState(0);
  const [status, setStatus]       = useState("draft");
  const [content, setContent]     = useState(() =>
    type === "edit"
      ? scaffoldFromExisting(curriculum, initialContent)
      : scaffoldBlank(curriculum)
  );

  const curriculumPeriods = curriculum.periods || [];
  const hasGrades = (content[0]?.classes?.length || 0) > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{ ...card, backgroundColor: "#F0F7FF", border: "1.5px solid #BFDBFE" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 2px", fontSize: "16px", fontWeight: "700", color: "#1E3A8A" }}>
              {type === "edit"
                ? `Editing → New Version ${nextVersionNumber}`
                : `Creating Version ${nextVersionNumber}`}
            </h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#3B82F6" }}>
              {type === "edit"
                ? "Courses pre-filled from current version. Add or remove as needed."
                : "All courses start blank. Fill in for each grade and period."}
            </p>
          </div>
          {/* Status selector */}
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`vc-status-btn${status === s.value ? ` sel-${s.value}` : ""}`}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: status === s.value ? s.dot : "#D1D5DB", flexShrink: 0 }} />
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Course editor */}
      {curriculumPeriods.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
            No periods configured. Go to <strong>Structure</strong> to set an academic cycle first.
          </p>
        </div>
      ) : !hasGrades ? (
        <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
            No grades found. Go to <strong>Structure</strong> to add grade levels first.
          </p>
        </div>
      ) : (
        <div style={card}>
          <PeriodTabs periods={curriculumPeriods} ayPeriods={ayPeriods} activeIdx={activeTab} onChange={setActiveTab} />
          <CourseMatrixEdit content={content} activeTab={activeTab} onUpdate={setContent} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button type="button" className="vc-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="vc-btn-primary"
          disabled={isPending}
          onClick={() => onSave({ content, status })}
        >
          {isPending ? <><Spinner /> Saving…</> : `Save as Version ${nextVersionNumber}`}
        </button>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function CurriculumVersionControlPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: curriculum,  isLoading: loadingCurr } = useCurriculumQuery(id);
  const { data: yearData,    isLoading: loadingYear } = useAcademicYears(id);
  const { data: versionData, isLoading: loadingVer  } = useCurriculumVersions(id);
  const { mutate: createVersion, isPending: creating } = useCreateCurriculumVersion(id);

  // mode: "view" | "new" | "edit" | "history" | "empty"
  const [mode, setMode]                   = useState("view");
  const [viewingVersion, setViewingVersion] = useState(null);

  const current           = versionData?.current || null;
  const history           = versionData?.history || [];
  const ayPeriods         = yearData?.current?.periods || [];
  const curriculumPeriods = curriculum?.periods || [];

  const allVersionNums = [
    ...(current ? [current.versionNumber] : []),
    ...history.map((v) => v.versionNumber),
  ];
  const nextVersionNumber = allVersionNums.length > 0 ? Math.max(...allVersionNums) + 1 : 1;

  useEffect(() => {
    if (!loadingVer && !current) setMode("empty");
  }, [loadingVer, current]);

  const isLoading = loadingCurr || loadingYear || loadingVer;

  const handleSave = (data) => {
    createVersion(
      { ...data, academicYearId: yearData?.current?.id || null },
      { onSuccess: () => { setMode("view"); setViewingVersion(null); } }
    );
  };

  const handleSelectHistory = (version) => {
    setViewingVersion(version);
    setMode("history");
  };

  const handleViewCurrent = () => {
    setViewingVersion(null);
    setMode(current ? "view" : "empty");
  };

  const handleRestore = () => {
    if (!viewingVersion) return;
    createVersion(
      { content: viewingVersion.content, status: "draft", academicYearId: yearData?.current?.id || null },
      { onSuccess: () => { setMode("view"); setViewingVersion(null); } }
    );
  };

  if (isLoading) return (
    <div style={{ fontFamily: "Inter,sans-serif" }}>
      <style>{CSS}</style>
      <SpinnerPage />
    </div>
  );

  const subtitleMap = {
    new:     `Creating Version ${nextVersionNumber} — blank slate.`,
    edit:    `Editing current version → will save as Version ${nextVersionNumber}.`,
    history: `Viewing Version ${viewingVersion?.versionNumber} (historical).`,
    empty:   "No versions yet. Create Version 1 to get started.",
    view:    "Course assignments by grade and period.",
  };

  return (
    <div style={{ fontFamily: "Inter,sans-serif" }}>
      <style>{CSS}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <button type="button" onClick={() => navigate("/curriculum")} style={{ background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter,sans-serif", cursor: "pointer", padding: 0 }}>
              ← Curriculum
            </button>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <span style={{ fontSize: "13px", color: "#6B7280", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{curriculum?.name}</span>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Version Control</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Version Control</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>{subtitleMap[mode]}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <button type="button" onClick={() => navigate(`/curriculum/${id}/academic-year`)} className="vc-btn-secondary">
            ← Academic Year
          </button>
          <button type="button" onClick={() => navigate("/curriculum")} className="vc-btn-secondary">
            Done
          </button>
        </div>
      </div>

      <StepIndicator current={4} />

      {/* Empty state */}
      {mode === "empty" && (
        <div className="vc-empty">
          <p style={{ fontSize: "28px", margin: "0 0 10px" }}>📋</p>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No versions yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF" }}>
            Assign courses to each grade and period to create Version 1.
          </p>
          <button type="button" className="vc-btn-primary" onClick={() => setMode("new")}>
            Start Version 1
          </button>
        </div>
      )}

      {/* Two-column layout */}
      {mode !== "empty" && (
        <div className="vc-layout">
          {/* LEFT: main content area */}
          <div>
            {mode === "view" && current && (
              <CurrentVersionPanel
                version={current}
                curriculumPeriods={curriculumPeriods}
                ayPeriods={ayPeriods}
                nextVersionNumber={nextVersionNumber}
                onNew={() => setMode("new")}
                onEdit={() => setMode("edit")}
              />
            )}

            {mode === "history" && viewingVersion && (
              <HistoricalVersionPanel
                version={viewingVersion}
                curriculumPeriods={curriculumPeriods}
                ayPeriods={ayPeriods}
                nextVersionNumber={nextVersionNumber}
                onRestore={handleRestore}
                isPending={creating}
                onBack={handleViewCurrent}
              />
            )}

            {(mode === "new" || mode === "edit") && (
              <VersionEditorPanel
                type={mode}
                curriculum={curriculum || { periods: [], structure: [] }}
                ayPeriods={ayPeriods}
                initialContent={mode === "edit" ? current?.content : null}
                nextVersionNumber={nextVersionNumber}
                onSave={handleSave}
                onCancel={() => setMode(current ? "view" : "empty")}
                isPending={creating}
              />
            )}
          </div>

          {/* RIGHT: version history sidebar */}
          <VersionHistorySidebar
            current={current}
            history={history}
            mode={mode}
            viewingId={viewingVersion?.id}
            onSelectHistory={handleSelectHistory}
            onViewCurrent={handleViewCurrent}
          />
        </div>
      )}
    </div>
  );
}
