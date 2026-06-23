import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import { useAcademicYears } from "../hooks/useAcademicYear";
import {
  useCurriculumVersions,
  useCreateCurriculumVersion,
} from "../hooks/useCurriculumVersion";

/* ── Constants ─────────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Academic Year" },
  { n: 4, label: "Version Control" },
];

const STATUSES = [
  { value: "draft",    label: "Draft",    bg: "#FFFBEB", border: "#FCD34D", color: "#92400E", dot: "#F59E0B" },
  { value: "active",   label: "Active",   bg: "#ECFDF5", border: "#6EE7B7", color: "#065F46", dot: "#10B981" },
  { value: "inactive", label: "Inactive", bg: "#F9FAFB", border: "#E5E7EB", color: "#6B7280", dot: "#9CA3AF" },
];

/* ── CSS ───────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }

  .vc-steps { display:flex; align-items:center; justify-content:center; margin-bottom:28px; }
  .vc-connector { width:60px; }
  @media (max-width:600px) { .vc-connector { width:28px; } .vc-steps { justify-content:flex-start; overflow-x:auto; padding-bottom:4px; } }

  .vc-period-tabs { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; margin-bottom:20px; }
  .vc-tab {
    padding:9px 18px; border-radius:10px; border:1.5px solid #E5E7EB;
    background:#fff; font-size:13px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; white-space:nowrap; transition:all 0.15s; color:#6B7280;
  }
  .vc-tab:hover { border-color:#93C5FD; color:#1D4ED8; }
  .vc-tab.active { border-color:#0D47A1; background:#EFF6FF; color:#0D47A1; }

  .vc-class-row {
    display:flex; align-items:flex-start; gap:12px; padding:14px 0;
    border-bottom:1px solid #F3F4F6;
  }
  .vc-class-row:last-child { border-bottom:none; }
  .vc-class-name {
    width:120px; flex-shrink:0; font-size:13px; font-weight:600;
    color:#374151; padding-top:4px; line-height:1.4;
  }
  .vc-chips { display:flex; flex-wrap:wrap; gap:6px; flex:1; align-items:center; }

  .vc-chip {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 10px; border-radius:20px; font-size:12px; font-weight:600;
    background:#EFF6FF; border:1.5px solid #BFDBFE; color:#1E3A8A;
    font-family:Inter,sans-serif;
  }
  .vc-chip-remove {
    width:14px; height:14px; border-radius:50%; border:none; background:rgba(29,58,138,0.1);
    color:#1E3A8A; cursor:pointer; display:flex; align-items:center; justify-content:center;
    font-size:10px; font-weight:700; padding:0; line-height:1; transition:background 0.1s;
  }
  .vc-chip-remove:hover { background:rgba(239,68,68,0.15); color:#EF4444; }

  .vc-add-btn {
    display:inline-flex; align-items:center; gap:4px;
    padding:5px 10px; border-radius:20px; font-size:12px; font-weight:600;
    background:transparent; border:1.5px dashed #D1D5DB; color:#9CA3AF;
    font-family:Inter,sans-serif; cursor:pointer; transition:all 0.15s;
  }
  .vc-add-btn:hover { border-color:#0D47A1; color:#0D47A1; background:#EFF6FF; }

  .vc-inline-form {
    display:flex; gap:8px; align-items:center; flex-wrap:wrap;
    padding:10px 14px; background:#F8FAFF; border-radius:10px;
    border:1.5px solid #E8F0FE; margin-top:8px; animation:fadeIn 0.15s ease;
  }
  .vc-inline-input {
    padding:7px 11px; border-radius:8px; border:1.5px solid #E5E7EB;
    font-size:13px; font-family:Inter,sans-serif; background:#fff; outline:none;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .vc-inline-input:focus { border-color:#0D47A1; box-shadow:0 0 0 3px rgba(13,71,161,0.1); }
  .vc-inline-input.name { width:160px; }
  .vc-inline-input.code { width:90px; }

  .vc-empty {
    text-align:center; padding:60px 24px; background:#FAFAFA;
    border:2px dashed #E5E7EB; border-radius:16px;
  }

  .vc-status-btn {
    flex:1; padding:10px 8px; border-radius:10px; border:1.5px solid #E5E7EB;
    background:#fff; font-size:13px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; text-align:center; transition:all 0.15s;
  }
  .vc-status-btn:hover:not(:disabled) { border-color:#93C5FD; }
  .vc-status-btn.sel-draft    { border-color:#FCD34D; background:#FFFBEB; color:#92400E; }
  .vc-status-btn.sel-active   { border-color:#6EE7B7; background:#ECFDF5; color:#065F46; }
  .vc-status-btn.sel-inactive { border-color:#D1D5DB; background:#F3F4F6; color:#6B7280; }

  .vc-btn-primary   { padding:10px 22px; background:#0D47A1; color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:background 0.15s; }
  .vc-btn-primary:disabled { background:#93C5FD; cursor:not-allowed; }
  .vc-btn-secondary { padding:10px 18px; background:transparent; color:#374151; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer; transition:all 0.15s; }
  .vc-btn-secondary:hover { background:#F9FAFB; }
`;

/* ── Helpers ───────────────────────────────────────────────────────────── */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;

const genId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function scaffoldContent(curriculum) {
  return (curriculum.periods || []).map((p) => ({
    periodName: p.name,
    classes: (curriculum.classes || []).map((cls) => ({ className: cls, courses: [] })),
  }));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function Spinner() {
  return <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />;
}

function SpinnerPage() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "360px", fontFamily: "Inter,sans-serif", gap: "14px", color: "#6B7280", fontSize: "14px" }}>
      <span style={{ width: "26px", height: "26px", border: "3px solid #E5E7EB", borderTopColor: "#0D47A1", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
      Loading…
    </div>
  );
}

function StatusDot({ status }) {
  const s = STATUSES.find((x) => x.value === status) || STATUSES[0];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", borderRadius: "20px", backgroundColor: s.bg, border: `1.5px solid ${s.border}`, color: s.color, fontSize: "12px", fontWeight: "700" }}>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

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
            {i < STEPS.length - 1 && <div className="vc-connector" style={{ height: "2px", backgroundColor: done ? "#0D47A1" : "#E5E7EB", margin: "0 6px", marginBottom: "20px", flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Period tabs ───────────────────────────────────────────────────────── */

function PeriodTabs({ periods, ayPeriods, activeIdx, onChange }) {
  return (
    <div className="vc-period-tabs">
      {periods.map((p, i) => {
        const ayp = ayPeriods.find((ap) => ap.name === p.name);
        const dates = (ayp?.startDate || ayp?.endDate)
          ? `${fmtDate(ayp.startDate) || "?"} – ${fmtDate(ayp.endDate) || "?"}`
          : null;
        return (
          <button key={p.name} type="button" onClick={() => onChange(i)} className={`vc-tab${activeIdx === i ? " active" : ""}`}>
            {p.name}
            {dates && <span style={{ fontSize: "11px", fontWeight: "400", marginLeft: "6px", opacity: 0.75 }}>{dates}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Inline add form ───────────────────────────────────────────────────── */

function InlineAddForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ id: genId(), name: name.trim(), code: code.trim() });
    setName(""); setCode("");
  };

  return (
    <form className="vc-inline-form" onSubmit={submit}>
      <input ref={nameRef} className="vc-inline-input name" placeholder="Course name *" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="vc-inline-input code" placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} />
      <button type="submit" disabled={!name.trim()} style={{ padding: "7px 14px", background: "#0D47A1", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", fontFamily: "Inter,sans-serif", cursor: name.trim() ? "pointer" : "not-allowed", opacity: name.trim() ? 1 : 0.5 }}>Add</button>
      <button type="button" onClick={onCancel} style={{ padding: "7px 12px", background: "transparent", color: "#9CA3AF", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter,sans-serif", cursor: "pointer" }}>Cancel</button>
    </form>
  );
}

/* ── Course matrix (view) ──────────────────────────────────────────────── */

function CourseMatrixView({ periodContent }) {
  if (!periodContent) return <p style={{ color: "#9CA3AF", fontSize: "13px" }}>No data for this period.</p>;
  return (
    <div>
      {periodContent.classes.map((cls) => (
        <div key={cls.className} className="vc-class-row">
          <div className="vc-class-name">{cls.className}</div>
          <div className="vc-chips">
            {cls.courses.length === 0
              ? <span style={{ fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No courses</span>
              : cls.courses.map((c) => (
                  <span key={c.id} className="vc-chip">
                    {c.name}{c.code ? <span style={{ opacity: 0.65, fontWeight: "400" }}> · {c.code}</span> : null}
                  </span>
                ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Course matrix (edit) ──────────────────────────────────────────────── */

function CourseMatrixEdit({ periodContent, periodIdx, onUpdate }) {
  const [addingFor, setAddingFor] = useState(null);

  if (!periodContent) return null;

  const removeCourse = (classIdx, courseId) => {
    const next = deepClone(periodContent);
    next.classes[classIdx].courses = next.classes[classIdx].courses.filter((c) => c.id !== courseId);
    onUpdate(periodIdx, next);
  };

  const addCourse = (classIdx, course) => {
    const next = deepClone(periodContent);
    next.classes[classIdx].courses.push(course);
    onUpdate(periodIdx, next);
    setAddingFor(null);
  };

  return (
    <div>
      {periodContent.classes.map((cls, classIdx) => (
        <div key={cls.className} style={{ paddingBottom: "4px" }}>
          <div className="vc-class-row">
            <div className="vc-class-name">{cls.className}</div>
            <div className="vc-chips">
              {cls.courses.map((c) => (
                <span key={c.id} className="vc-chip">
                  {c.name}{c.code ? <span style={{ opacity: 0.65, fontWeight: "400" }}> · {c.code}</span> : null}
                  <button type="button" className="vc-chip-remove" onClick={() => removeCourse(classIdx, c.id)} title="Remove course">×</button>
                </span>
              ))}
              {addingFor !== classIdx && (
                <button type="button" className="vc-add-btn" onClick={() => setAddingFor(classIdx)}>
                  <span style={{ fontSize: "14px", lineHeight: 1 }}>+</span> Add course
                </button>
              )}
            </div>
          </div>
          {addingFor === classIdx && (
            <div style={{ paddingLeft: "132px" }}>
              <InlineAddForm
                onAdd={(course) => addCourse(classIdx, course)}
                onCancel={() => setAddingFor(null)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── View mode ─────────────────────────────────────────────────────────── */

function VersionView({ current, ayPeriods, curriculumPeriods }) {
  const [activeTab, setActiveTab] = useState(0);
  const content = current.content || [];
  const periodContent = content[activeTab] || null;
  const card = { backgroundColor: "#fff", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)", marginBottom: "20px" };

  return (
    <div>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0F2645" }}>Version {current.versionNumber}</h2>
          <StatusDot status={current.status} />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6B7280" }}>
          Saved {new Date(current.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      </div>

      <div style={card}>
        <PeriodTabs periods={curriculumPeriods} ayPeriods={ayPeriods} activeIdx={activeTab} onChange={setActiveTab} />
        <CourseMatrixView periodContent={periodContent} />
      </div>
    </div>
  );
}

/* ── Create mode ───────────────────────────────────────────────────────── */

function VersionEdit({ curriculum, ayPeriods, onSave, onCancel, isPending }) {
  const [activeTab,  setActiveTab]  = useState(0);
  const [editStatus, setEditStatus] = useState("draft");
  const [content, setContent] = useState(() => scaffoldContent(curriculum));

  const curriculumPeriods = curriculum.periods || [];

  const handleUpdate = (periodIdx, updatedPeriod) => {
    setContent((prev) => prev.map((p, i) => (i === periodIdx ? updatedPeriod : p)));
  };

  const card = { backgroundColor: "#fff", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)", marginBottom: "20px" };

  return (
    <div>
      {/* Status */}
      <div style={card}>
        <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Status</p>
        <div style={{ display: "flex", gap: "8px" }}>
          {STATUSES.map((s) => (
            <button key={s.value} type="button" onClick={() => setEditStatus(s.value)} className={`vc-status-btn${editStatus === s.value ? ` sel-${s.value}` : ""}`}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: editStatus === s.value ? s.dot : "#D1D5DB", flexShrink: 0 }} />
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Course editor */}
      {curriculumPeriods.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No periods configured. Go back to <strong>Structure</strong> to set an academic cycle first.</p>
        </div>
      ) : (curriculum.classes || []).length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No classes found. Go back to <strong>Structure</strong> to add grade levels first.</p>
        </div>
      ) : (
        <div style={card}>
          <PeriodTabs periods={curriculumPeriods} ayPeriods={ayPeriods} activeIdx={activeTab} onChange={setActiveTab} />
          <CourseMatrixEdit periodContent={content[activeTab]} periodIdx={activeTab} onUpdate={handleUpdate} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} className="vc-btn-secondary">Cancel</button>
        <button type="button" disabled={isPending} onClick={() => onSave({ content, status: editStatus })} className="vc-btn-primary">
          {isPending ? <><Spinner /> Saving…</> : "Create Version 1"}
        </button>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function CurriculumVersionControlPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: curriculum,   isLoading: loadingCurr } = useCurriculumQuery(id);
  const { data: yearData,     isLoading: loadingYear } = useAcademicYears(id);
  const { data: versionData,  isLoading: loadingVer  } = useCurriculumVersions(id);

  const { mutate: createVersion, isPending: creating } = useCreateCurriculumVersion(id);

  const [mode, setMode] = useState("view");

  const current = versionData?.current || null;
  const ayPeriods = yearData?.current?.periods || [];
  const curriculumPeriods = curriculum?.periods || [];

  useEffect(() => {
    if (!loadingVer && !current) setMode("create");
  }, [loadingVer, current]);

  const isLoading = loadingCurr || loadingYear || loadingVer;

  const handleSaveCreate = (data) => {
    createVersion(data, { onSuccess: () => setMode("view") });
  };

  if (isLoading) return (
    <div style={{ fontFamily: "Inter,sans-serif" }}>
      <style>{CSS}</style>
      <SpinnerPage />
    </div>
  );

  return (
    <div style={{ fontFamily: "Inter,sans-serif" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <button type="button" onClick={() => navigate("/curriculum")} style={{ background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter,sans-serif", cursor: "pointer", padding: 0 }}>← Curriculum</button>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <span style={{ fontSize: "13px", color: "#6B7280", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{curriculum?.name}</span>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Version Control</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Version Control</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
            {mode === "create" ? "Add courses to each class by period to create Version 1." : "Course assignments for this curriculum."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <button type="button" onClick={() => navigate(`/curriculum/${id}/academic-year`)} className="vc-btn-secondary">← Academic Year</button>
          <button type="button" onClick={() => navigate("/curriculum")} className="vc-btn-secondary">Done</button>
        </div>
      </div>

      <StepIndicator current={4} />

      {/* No version yet (waiting for create mode to kick in) */}
      {!current && mode === "view" && (
        <div className="vc-empty">
          <p style={{ fontSize: "32px", margin: "0 0 12px" }}>📋</p>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "700", color: "#374151" }}>No version yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF" }}>Assign courses to each class and period to create Version 1.</p>
          <button type="button" onClick={() => setMode("create")} className="vc-btn-primary">Start Version 1</button>
        </div>
      )}

      {mode === "create" && (
        <VersionEdit
          curriculum={curriculum || { periods: [], classes: [] }}
          ayPeriods={ayPeriods}
          onSave={handleSaveCreate}
          onCancel={() => navigate("/curriculum")}
          isPending={creating}
        />
      )}

      {mode === "view" && current && (
        <VersionView
          current={current}
          ayPeriods={ayPeriods}
          curriculumPeriods={curriculumPeriods}
        />
      )}
    </div>
  );
}
