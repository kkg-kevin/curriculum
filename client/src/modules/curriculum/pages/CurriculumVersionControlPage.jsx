import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import { useAcademicYears } from "../hooks/useAcademicYear";
import {
  useCurriculumVersions,
  useCreateCurriculumVersion,
  useChangeCurriculumVersionStatus,
} from "../hooks/useCurriculumVersion";

/* ── Constants ─────────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Academic Year" },
  { n: 4, label: "Version Control" },
];

const STATUSES = [
  { value: "draft",     label: "Draft",     bg: "#FFFBEB", border: "#FCD34D", color: "#92400E", dot: "#F59E0B" },
  { value: "published", label: "Published", bg: "#fff8e6", border: "#fcd97a", color: "#b07800", dot: "#feb139" },
  { value: "inactive",  label: "Inactive",  bg: "#F9FAFB", border: "#E5E7EB", color: "#6B7280", dot: "#9CA3AF" },
];

/* ── CSS ───────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes vc-spin   { to { transform: rotate(360deg); } }
  @keyframes vc-fadein { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

  .vc-steps { display:flex; align-items:center; justify-content:center; margin-bottom:32px; }
  .vc-connector { width:64px; height:2px; flex-shrink:0; margin:0 6px; margin-bottom:20px; }
  @media(max-width:580px){ .vc-connector{width:24px;} .vc-steps{justify-content:flex-start;overflow-x:auto;padding-bottom:4px;} }

  .vc-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 240px;
    gap: 20px;
    align-items: start;
  }
  @media(max-width:960px){ .vc-layout{ grid-template-columns:1fr; } }

  .vc-period-tabs { display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; margin-bottom:20px; }
  .vc-period-tabs::-webkit-scrollbar { height:3px; }
  .vc-period-tabs::-webkit-scrollbar-thumb { background:#E5E7EB; border-radius:4px; }

  .vc-tab {
    padding:7px 16px; border-radius:8px; border:1.5px solid #E5E7EB;
    background:#fff; font-size:12px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; white-space:nowrap; transition:all 0.15s; color:#6B7280; flex-shrink:0;
  }
  .vc-tab:hover  { border-color:#b8d9ee; color:#38aae1; background:#F8FBFF; }
  .vc-tab.active { border-color:#25476a; background:#e8f5fb; color:#25476a; box-shadow:0 1px 4px rgba(37,71,106,0.12); }

  .vc-class-row {
    display:flex; align-items:flex-start; gap:14px; padding:12px 0;
    border-bottom:1px solid #F3F4F6;
  }
  .vc-class-row:last-child { border-bottom:none; }
  .vc-class-label {
    width:120px; flex-shrink:0; font-size:12px; font-weight:700;
    color:#374151; padding-top:4px; line-height:1.4;
  }
  .vc-chips { display:flex; flex-wrap:wrap; gap:5px; flex:1; min-width:0; align-items:center; }

  .vc-chip {
    display:inline-flex; align-items:center; gap:5px;
    padding:4px 10px; border-radius:20px; font-size:11px; font-weight:600;
    background:#e8f5fb; border:1.5px solid #a8d5ee; color:#25476a; font-family:Inter,sans-serif;
  }
  .vc-chip-x {
    width:14px; height:14px; border-radius:50%; border:none;
    background:rgba(29,58,138,0.1); color:#25476a; cursor:pointer;
    display:inline-flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:900; padding:0; transition:background 0.1s, color 0.1s; flex-shrink:0;
  }
  .vc-chip-x:hover { background:rgba(239,68,68,0.2); color:#DC2626; }

  .vc-add-pill {
    display:inline-flex; align-items:center; gap:4px;
    padding:4px 10px; border-radius:20px; font-size:11px; font-weight:600;
    background:transparent; border:1.5px dashed #D1D5DB; color:#9CA3AF;
    font-family:Inter,sans-serif; cursor:pointer; transition:all 0.15s; flex-shrink:0;
  }
  .vc-add-pill:hover { border-color:#25476a; color:#25476a; background:#e8f5fb; }

  .vc-inline-form {
    display:flex; gap:8px; align-items:center; flex-wrap:wrap;
    padding:10px 14px; background:#F0F7FF; border-radius:10px;
    border:1.5px solid #C7D9F8; margin-top:6px; animation:vc-fadein 0.15s ease;
  }
  .vc-inline-input {
    padding:6px 10px; border-radius:7px; border:1.5px solid #D1D5DB;
    font-size:12px; font-family:Inter,sans-serif; background:#fff; outline:none;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .vc-inline-input:focus { border-color:#25476a; box-shadow:0 0 0 3px rgba(37,71,106,0.08); }
  .vc-inline-input.iname { width:160px; }
  .vc-inline-input.icode { width:88px; }

  .vc-empty-state {
    text-align:center; padding:72px 32px; background:#FAFAFA;
    border:2px dashed #E5E7EB; border-radius:20px; animation:vc-fadein 0.2s ease;
  }

  /* Buttons */
  .vc-btn-primary {
    padding:8px 18px; background:#25476a; color:#fff; border:none; border-radius:9px;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer;
    display:inline-flex; align-items:center; gap:7px; transition:background 0.15s;
    white-space:nowrap;
  }
  .vc-btn-primary:hover:not(:disabled) { background:#0A3880; }
  .vc-btn-primary:disabled { background:#b8d9ee; cursor:not-allowed; }

  .vc-btn-secondary {
    padding:8px 16px; background:#fff; color:#374151;
    border:1.5px solid #E5E7EB; border-radius:9px; font-size:13px; font-weight:600;
    font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center;
    gap:6px; transition:all 0.15s; white-space:nowrap;
  }
  .vc-btn-secondary:hover { background:#F3F4F6; }

  .vc-btn-ghost {
    padding:8px 16px; background:#e8f5fb; color:#25476a;
    border:1.5px solid #a8d5ee; border-radius:9px; font-size:13px; font-weight:600;
    font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center;
    gap:7px; transition:all 0.15s; white-space:nowrap;
  }
  .vc-btn-ghost:hover { background:#d6edf8; }

  .vc-btn-publish {
    padding:8px 18px; background:#feb139; color:#25476a; border:none; border-radius:9px;
    font-size:13px; font-weight:700; font-family:Inter,sans-serif; cursor:pointer;
    display:inline-flex; align-items:center; gap:7px; transition:background 0.15s;
    white-space:nowrap;
  }
  .vc-btn-publish:hover:not(:disabled) { background:#f0a800; }
  .vc-btn-publish:disabled { background:#fef3d0; cursor:not-allowed; }

  .vc-btn-restore {
    padding:8px 16px; background:#e8f5fb; color:#25476a;
    border:1.5px solid #a8d5ee; border-radius:9px; font-size:13px; font-weight:600;
    font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center;
    gap:7px; transition:all 0.15s; white-space:nowrap;
  }
  .vc-btn-restore:hover:not(:disabled) { background:#d6edf8; }
  .vc-btn-restore:disabled { opacity:0.5; cursor:not-allowed; }

  /* Status selector in editor */
  .vc-status-pill {
    padding:6px 14px; border-radius:8px; border:1.5px solid #E5E7EB;
    background:#fff; font-size:12px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; transition:all 0.15s; display:inline-flex; align-items:center; gap:5px;
  }
  .vc-status-pill:hover:not(.sp-active) { border-color:#CBD5E1; background:#F8FAFC; }
  .vc-status-pill.sp-draft    { border-color:#FCD34D; background:#FFFBEB; color:#92400E; }
  .vc-status-pill.sp-inactive { border-color:#D1D5DB; background:#F3F4F6; color:#6B7280; }

  /* Sidebar */
  .vc-sidebar {
    background:#fff; border-radius:16px; border:1.5px solid #E5E7EB;
    box-shadow:0 2px 8px rgba(0,0,0,0.04); overflow:hidden; position:sticky; top:20px;
  }
  .vc-sidebar-head {
    padding:14px 16px 12px; border-bottom:1px solid #F0F0F0;
    background:linear-gradient(135deg,#0A3880,#2e7db5);
  }

  /* Timeline */
  .vc-tl-list { position:relative; }
  .vc-tl-line { position:absolute; left:22px; top:0; bottom:0; width:2px; background:#F0F0F0; pointer-events:none; }
  .vc-tl-entry {
    display:flex; align-items:flex-start; gap:0;
    padding:10px 14px 10px 0; cursor:pointer; transition:background 0.12s;
    position:relative; border-bottom:1px solid #F5F5F5;
    background:none; border-left:none; border-right:none; border-top:none;
    width:100%; text-align:left; font-family:Inter,sans-serif;
  }
  .vc-tl-entry:last-child { border-bottom:none; }
  .vc-tl-entry:hover { background:#F9FAFB; }
  .vc-tl-entry.tl-published { background:#fff8e6; }
  .vc-tl-entry.tl-focused   { background:#FFFBEB; }

  .vc-tl-dot-wrap { width:44px; display:flex; flex-direction:column; align-items:center; flex-shrink:0; padding-top:3px; }
  .vc-tl-dot { width:12px; height:12px; border-radius:50%; flex-shrink:0; border:2px solid #E5E7EB; background:#fff; transition:all 0.15s; }
  .tl-published .vc-tl-dot { background:#feb139; border-color:#feb139; box-shadow:0 0 0 3px rgba(254,177,57,0.2); }
  .tl-focused   .vc-tl-dot { background:#F59E0B; border-color:#F59E0B; box-shadow:0 0 0 3px rgba(245,158,11,0.15); }

  .vc-tl-body { flex:1; min-width:0; padding-right:4px; }
  .vc-tl-top  { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:3px; }
  .vc-tl-vnum { font-size:13px; font-weight:700; color:#111827; white-space:nowrap; }
  .vc-tl-date { font-size:10px; color:#9CA3AF; margin-top:1px; }
  .vc-tl-badges { display:flex; gap:4px; flex-wrap:wrap; margin-top:4px; }
`;

/* ── Shared styles ─────────────────────────────────────────────────────── */

const card = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  padding: "22px 24px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)",
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const genId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function scaffoldBlank(curriculum) {
  const map = new Map();
  (curriculum.structure || []).forEach((t) => {
    (t.grades || []).forEach((g) => {
      const k = g.id || g.name;
      if (k && !map.has(k)) map.set(k, g.name || g);
    });
  });
  let names = [...map.values()];
  if (!names.length) names = curriculum.classes || [];
  return (curriculum.periods || []).map((p) => ({
    periodName: p.name,
    classes: names.map((n) => ({ className: n, courses: [] })),
  }));
}

function scaffoldFromExisting(curriculum, existingContent) {
  const map = new Map();
  (curriculum.structure || []).forEach((t) => {
    (t.grades || []).forEach((g) => {
      const k = g.id || g.name;
      if (k && !map.has(k)) map.set(k, g.name || g);
    });
  });
  let names = [...map.values()];
  if (!names.length) names = curriculum.classes || [];
  return (curriculum.periods || []).map((p) => {
    const ep = (existingContent || []).find((x) => x.periodName === p.name);
    return {
      periodName: p.name,
      classes: names.map((n) => {
        const ec = ep?.classes?.find((c) => c.className === n);
        return { className: n, courses: ec?.courses || [] };
      }),
    };
  });
}

const deepClone = (o) => JSON.parse(JSON.stringify(o));

/* ── Atoms ─────────────────────────────────────────────────────────────── */

function Spinner({ size = 13, light = true }) {
  return (
    <span style={{ width: `${size}px`, height: `${size}px`, border: `2px solid ${light ? "rgba(255,255,255,0.4)" : "#E5E7EB"}`, borderTopColor: light ? "#fff" : "#25476a", borderRadius: "50%", display: "inline-block", animation: "vc-spin 0.7s linear infinite", flexShrink: 0 }} />
  );
}

function SpinnerPage() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "380px", fontFamily: "Inter,sans-serif", gap: "14px", color: "#6B7280", fontSize: "14px" }}>
      <span style={{ width: "28px", height: "28px", border: "3px solid #E5E7EB", borderTopColor: "#25476a", borderRadius: "50%", display: "inline-block", animation: "vc-spin 0.7s linear infinite" }} />
      Loading…
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUSES.find((x) => x.value === status) || STATUSES[0];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", borderRadius: "20px", backgroundColor: s.bg, border: `1.5px solid ${s.border}`, color: s.color, fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function MiniTag({ children, color, bg, border }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: "20px", backgroundColor: bg, border: `1px solid ${border}`, color, fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap" }}>
      {children}
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
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", backgroundColor: done || active ? "#25476a" : "#F3F4F6", border: `2.5px solid ${done || active ? "#25476a" : "#E5E7EB"}`, display: "flex", alignItems: "center", justifyContent: "center", color: done || active ? "#fff" : "#9CA3AF", fontSize: done ? "15px" : "13px", fontWeight: "700", flexShrink: 0, boxShadow: active ? "0 0 0 4px rgba(37,71,106,0.1)" : "none" }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{ fontSize: "11px", fontWeight: active ? "700" : "400", color: active ? "#25476a" : done ? "#374151" : "#9CA3AF", whiteSpace: "nowrap" }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="vc-connector" style={{ backgroundColor: done ? "#25476a" : "#E5E7EB" }} />}
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
        const ayp = ayPeriods.find((a) => a.name === p.name);
        const dates = ayp?.startDate || ayp?.endDate
          ? `${fmtDate(ayp.startDate)} – ${fmtDate(ayp.endDate)}` : null;
        return (
          <button key={p.name} type="button" onClick={() => onChange(i)} className={`vc-tab${activeIdx === i ? " active" : ""}`}>
            {p.name}
            {dates && <span style={{ fontSize: "10px", fontWeight: "400", marginLeft: "6px", opacity: 0.65 }}>{dates}</span>}
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
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ id: genId(), name: name.trim(), code: code.trim() });
    setName(""); setCode("");
  };

  return (
    <form className="vc-inline-form" onSubmit={submit}>
      <input ref={ref} className="vc-inline-input iname" placeholder="Course name *" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="vc-inline-input icode" placeholder="Code (opt.)" value={code} onChange={(e) => setCode(e.target.value)} />
      <button type="submit" disabled={!name.trim()} style={{ padding: "6px 12px", background: "#25476a", color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", fontWeight: "700", fontFamily: "Inter,sans-serif", cursor: name.trim() ? "pointer" : "not-allowed", opacity: name.trim() ? 1 : 0.5 }}>Add</button>
      <button type="button" onClick={onCancel} style={{ padding: "6px 10px", background: "transparent", color: "#9CA3AF", border: "1.5px solid #E5E7EB", borderRadius: "7px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter,sans-serif", cursor: "pointer" }}>Cancel</button>
    </form>
  );
}

/* ── CourseMatrixView ──────────────────────────────────────────────────── */

function CourseMatrixView({ content, activeTab }) {
  const pc = content[activeTab];
  if (!pc) return <p style={{ color: "#9CA3AF", fontSize: "13px", margin: 0, padding: "16px 0" }}>No data for this period.</p>;
  if (!pc.classes?.length) return <p style={{ color: "#D1D5DB", fontSize: "13px", fontStyle: "italic", margin: 0, padding: "16px 0" }}>No grades configured.</p>;
  return (
    <div>
      {pc.classes.map((cls) => (
        <div key={cls.className} className="vc-class-row">
          <div className="vc-class-label">{cls.className}</div>
          <div className="vc-chips">
            {cls.courses.length === 0
              ? <span style={{ fontSize: "11px", color: "#D1D5DB", fontStyle: "italic" }}>No courses added</span>
              : cls.courses.map((c) => (
                  <span key={c.id} className="vc-chip">
                    {c.name}
                    {c.code ? <span style={{ opacity: 0.55, fontWeight: "400" }}>&thinsp;{c.code}</span> : null}
                  </span>
                ))}
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

  const pc = content[activeTab];
  if (!pc) return null;
  if (!pc.classes?.length) return <p style={{ color: "#D1D5DB", fontSize: "13px", fontStyle: "italic", margin: 0, padding: "16px 0" }}>No grades configured. Add grades in Structure first.</p>;

  const removeCourse = (ci, courseId) => {
    const next = deepClone(content);
    next[activeTab].classes[ci].courses = next[activeTab].classes[ci].courses.filter((c) => c.id !== courseId);
    onUpdate(next);
  };
  const addCourse = (ci, course) => {
    const next = deepClone(content);
    next[activeTab].classes[ci].courses.push(course);
    onUpdate(next);
    setAddingFor(null);
  };

  return (
    <div>
      {pc.classes.map((cls, ci) => (
        <div key={cls.className}>
          <div className="vc-class-row">
            <div className="vc-class-label">{cls.className}</div>
            <div className="vc-chips">
              {cls.courses.map((c) => (
                <span key={c.id} className="vc-chip">
                  {c.name}
                  {c.code ? <span style={{ opacity: 0.55, fontWeight: "400" }}>&thinsp;{c.code}</span> : null}
                  <button type="button" className="vc-chip-x" onClick={() => removeCourse(ci, c.id)}>×</button>
                </span>
              ))}
              {addingFor !== ci && (
                <button type="button" className="vc-add-pill" onClick={() => setAddingFor(ci)}>
                  <span style={{ fontSize: "14px", fontWeight: "700" }}>+</span> Add
                </button>
              )}
            </div>
          </div>
          {addingFor === ci && (
            <div style={{ paddingLeft: "134px", paddingBottom: "8px" }}>
              <InlineAddForm onAdd={(c) => addCourse(ci, c)} onCancel={() => setAddingFor(null)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── VersionHistorySidebar ─────────────────────────────────────────────── */

function VersionHistorySidebar({ published, history, focusedId, onSelect }) {
  const allVersions = [
    ...(published ? [{ ...published, _published: true }] : []),
    ...history,
  ];

  return (
    <div className="vc-sidebar">
      <div className="vc-sidebar-head">
        <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase" }}>Version History</p>
        <p style={{ margin: "3px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
          {allVersions.length} {allVersions.length === 1 ? "version" : "versions"}
        </p>
      </div>

      {allVersions.length === 0 ? (
        <div style={{ padding: "28px 16px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", lineHeight: 1.5 }}>No versions yet.</p>
        </div>
      ) : (
        <div className="vc-tl-list" style={{ maxHeight: "520px", overflowY: "auto" }}>
          <div className="vc-tl-line" />
          {allVersions.map((v) => {
            const isPub    = !!v._published;
            const isFocused = v.id === focusedId && !isPub;
            let cls = "vc-tl-entry";
            if (isPub)     cls += " tl-published";
            if (isFocused) cls += " tl-focused";

            return (
              <button key={v.id} type="button" className={cls} style={{ paddingLeft: 0 }} onClick={() => onSelect(v)}>
                <div className="vc-tl-dot-wrap"><div className="vc-tl-dot" /></div>
                <div className="vc-tl-body">
                  <div className="vc-tl-top">
                    <span className="vc-tl-vnum">v{v.versionNumber}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="vc-tl-date">{fmtDate(v.createdAt)}</div>
                  <div className="vc-tl-badges">
                    {isPub    && <MiniTag color="#b07800" bg="#fff8e6" border="#fcd97a">LIVE</MiniTag>}
                    {isFocused && <MiniTag color="#92400E" bg="#FFFBEB" border="#FCD34D">VIEWING</MiniTag>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── BrowsePanel — shows any version with contextual actions ───────────── */

function BrowsePanel({
  version, curriculumPeriods, ayPeriods, nextVersionNumber,
  publishedId, onPublish, onEdit, onNew, onRestore,
  isPublishing, isRestoring,
}) {
  const [activeTab, setActiveTab] = useState(0);
  const { status } = version;
  const isPublished = status === "published";
  const isDraft     = status === "draft";
  const isInactive  = status === "inactive";
  const totalCourses = (version.content || []).reduce((s, p) => s + p.classes.reduce((s2, c) => s2 + c.courses.length, 0), 0);

  /* Header accent by status */
  const accent = isPublished
    ? { bg: "#fff8e6", border: "#fcd97a", titleColor: "#b07800" }
    : isDraft
    ? { bg: "#F0F7FF", border: "#a8d5ee", titleColor: "#25476a" }
    : { bg: "#FAFAFA", border: "#E5E7EB", titleColor: "#374151" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "vc-fadein 0.2s ease" }}>
      {/* Banner for published */}
      {isPublished && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", backgroundColor: "#fff8e6", border: "1.5px solid #fcd97a", borderRadius: "12px" }}>
          <span style={{ fontSize: "16px" }}>✅</span>
          <p style={{ margin: 0, fontSize: "12px", color: "#b07800", fontWeight: "500" }}>
            This is the <strong>live version</strong> currently in use.
          </p>
        </div>
      )}
      {isDraft && !publishedId && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", backgroundColor: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: "12px" }}>
          <span style={{ fontSize: "16px" }}>📋</span>
          <p style={{ margin: 0, fontSize: "12px", color: "#92400E", fontWeight: "500" }}>
            No version is live yet. Publish this draft to make it active.
          </p>
        </div>
      )}
      {isInactive && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "12px" }}>
          <span style={{ fontSize: "16px" }}>🕐</span>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", fontWeight: "500" }}>
            Historical version — restore to create a new draft based on this content.
          </p>
        </div>
      )}

      {/* Header card */}
      <div style={{ ...card, backgroundColor: accent.bg, border: `1.5px solid ${accent.border}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: accent.titleColor }}>
                Version {version.versionNumber}
              </h2>
              <StatusBadge status={status} />
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "#9CA3AF" }}>Saved {fmtDate(version.createdAt)}</span>
              <span style={{ fontSize: "12px", color: "#9CA3AF" }}>·</span>
              <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: "600" }}>
                {totalCourses} course{totalCourses !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flexShrink: 0 }}>
            {/* Inactive → Restore */}
            {isInactive && (
              <button type="button" className="vc-btn-restore" onClick={onRestore} disabled={isRestoring}>
                {isRestoring ? <><Spinner light={false} /> Restoring…</> : `↩ Restore as v${nextVersionNumber}`}
              </button>
            )}
            {/* Draft → Publish + Edit + New */}
            {isDraft && (
              <>
                <button type="button" className="vc-btn-publish" onClick={onPublish} disabled={isPublishing}>
                  {isPublishing ? <><Spinner /> Publishing…</> : "🚀 Publish"}
                </button>
                <button type="button" className="vc-btn-ghost" onClick={onEdit}>
                  ✏ Edit
                </button>
                <button type="button" className="vc-btn-primary" onClick={onNew}>+ New Version</button>
              </>
            )}
            {/* Published → Edit + New */}
            {isPublished && (
              <>
                <button type="button" className="vc-btn-ghost" onClick={onEdit}>
                  ✏ Edit → v{nextVersionNumber}
                </button>
                <button type="button" className="vc-btn-primary" onClick={onNew}>+ New Version</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Course matrix */}
      <div style={card}>
        {curriculumPeriods.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No periods configured in structure.</p>
          </div>
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

/* ── EditorPanel ───────────────────────────────────────────────────────── */

function EditorPanel({ type, curriculum, ayPeriods, initialContent, nextVersionNumber, onSave, onCancel, isPending }) {
  const [activeTab, setActiveTab] = useState(0);
  const [content, setContent]     = useState(() =>
    type === "edit" ? scaffoldFromExisting(curriculum, initialContent) : scaffoldBlank(curriculum)
  );

  const periods   = curriculum.periods || [];
  const hasGrades = (content[0]?.classes?.length || 0) > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "vc-fadein 0.2s ease" }}>
      {/* Info banner */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 16px", backgroundColor: "#e8f5fb", border: "1.5px solid #a8d5ee", borderRadius: "12px" }}>
        <span style={{ fontSize: "14px", flexShrink: 0 }}>{type === "edit" ? "✏️" : "📋"}</span>
        <p style={{ margin: 0, fontSize: "12px", color: "#25476a", fontWeight: "500" }}>
          {type === "edit"
            ? "Courses pre-filled from the selected version. Add or remove as needed."
            : "All courses start blank. Fill in each grade for every period."}
          {" "}<strong>Saving creates a new draft</strong> — publish it when ready.
        </p>
      </div>

      {/* Header */}
      <div style={{ ...card, backgroundColor: "#F0F7FF", border: "1.5px solid #a8d5ee" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 3px", fontSize: "18px", fontWeight: "800", color: "#25476a" }}>
              {type === "edit" ? `Editing → Version ${nextVersionNumber}` : `New Version ${nextVersionNumber}`}
            </h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#3B82F6" }}>Saves as a draft — you can publish it from the version panel.</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" className="vc-btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="vc-btn-primary" disabled={isPending} onClick={() => onSave({ content })}>
              {isPending ? <><Spinner /> Saving…</> : `Save Draft v${nextVersionNumber}`}
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      {periods.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No periods configured. Go to <strong>Structure</strong> first.</p>
        </div>
      ) : !hasGrades ? (
        <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No grades found. Go to <strong>Structure</strong> to add grade levels first.</p>
        </div>
      ) : (
        <div style={card}>
          <PeriodTabs periods={periods} ayPeriods={ayPeriods} activeIdx={activeTab} onChange={setActiveTab} />
          <CourseMatrixEdit content={content} activeTab={activeTab} onUpdate={setContent} />
        </div>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function CurriculumVersionControlPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const { data: curriculum,  isLoading: lCurr } = useCurriculumQuery(id);
  const { data: yearData,    isLoading: lYear  } = useAcademicYears(id);
  const { data: versionData, isLoading: lVer   } = useCurriculumVersions(id);
  const { mutate: createVersion,  isPending: creating    } = useCreateCurriculumVersion(id);
  const { mutate: changeStatus,   isPending: changingSt  } = useChangeCurriculumVersionStatus(id);

  // mode: "browse" | "new" | "edit" | "empty"
  const [mode, setMode]             = useState("browse");
  // focusedVersion: null means "show the published version"; otherwise show this specific version
  const [focusedVersion, setFocused] = useState(null);
  // editSourceVersion: which version we're editing (null = published/current)
  const [editSource, setEditSource]  = useState(null);

  const published = versionData?.current || null;   // isCurrent version
  const history   = versionData?.history || [];     // everything else
  // Derive periods from the published academic year version (two-level group→version structure)
  const ayPeriods = yearData?.publishedVersion?.periods || [];
  const periods   = curriculum?.periods || [];

  const allVersions   = [...(published ? [published] : []), ...history];
  const allNums       = allVersions.map((v) => v.versionNumber);
  const nextVersionNum = allNums.length ? Math.max(...allNums) + 1 : 1;

  // Derive the version shown in browse mode
  const displayVersion = focusedVersion
    ? allVersions.find((v) => v.id === focusedVersion.id) || focusedVersion
    : published || history[0] || null;

  useEffect(() => {
    if (!lVer && allVersions.length === 0) setMode("empty");
    else if (!lVer && allVersions.length > 0 && mode === "empty") setMode("browse");
  }, [lVer, allVersions.length]);

  /* Handlers */
  const handleSaveEditor = (data) => {
    createVersion(
      { ...data, status: "draft", academicYearId: yearData?.publishedVersion?.id || null },
      {
        onSuccess: (newVer) => {
          setFocused(newVer);
          setMode("browse");
        },
      }
    );
  };

  const handlePublish = () => {
    if (!displayVersion) return;
    changeStatus(
      { vId: displayVersion.id, status: "published" },
      { onSuccess: () => setFocused(null) }
    );
  };

  const handleRestore = () => {
    if (!displayVersion) return;
    createVersion(
      { content: displayVersion.content, status: "draft", academicYearId: yearData?.publishedVersion?.id || null },
      {
        onSuccess: (newVer) => {
          setFocused(newVer);
          setMode("browse");
        },
      }
    );
  };

  const handleSelectVersion = (v) => {
    const isPub = v.id === published?.id;
    setFocused(isPub ? null : v);
    setMode("browse");
  };

  const handleEdit = () => {
    setEditSource(displayVersion);
    setMode("edit");
  };

  const handleNew = () => {
    setEditSource(null);
    setMode("new");
  };

  const handleCancelEditor = () => {
    setEditSource(null);
    setMode(allVersions.length ? "browse" : "empty");
  };

  if (lCurr || lYear || lVer) return (
    <div style={{ fontFamily: "Inter,sans-serif" }}>
      <style>{CSS}</style>
      <SpinnerPage />
    </div>
  );

  const subtitleMap = {
    new:    `Creating Version ${nextVersionNum} — saves as draft.`,
    edit:   `Editing → Version ${nextVersionNum} (saves as draft).`,
    browse: displayVersion
      ? `Viewing Version ${displayVersion.versionNumber} · ${STATUSES.find(s => s.value === displayVersion.status)?.label || "Unknown"}`
      : "No versions yet.",
    empty:  "No versions yet. Create the first one to get started.",
  };

  return (
    <div style={{ fontFamily: "Inter,sans-serif" }}>
      <style>{CSS}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <button type="button" onClick={() => navigate("/curriculum")} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "12px", fontFamily: "Inter,sans-serif", cursor: "pointer", padding: 0 }}>
              Curriculum
            </button>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#9CA3AF", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{curriculum?.name}</span>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>Version Control</span>
          </div>
          <h1 style={{ margin: "0 0 3px", fontSize: "22px", fontWeight: "800", color: "#0F2645" }}>Version Control</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{subtitleMap[mode]}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button type="button" onClick={() => navigate(`/curriculum/${id}/academic-year`)} className="vc-btn-secondary">← Academic Year</button>
          <button type="button" onClick={() => navigate("/curriculum")} className="vc-btn-primary" style={{ background: "#0F2645" }}>Done</button>
        </div>
      </div>

      <StepIndicator current={4} />

      {/* Empty state */}
      {mode === "empty" && (
        <div className="vc-empty-state">
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📋</div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No versions yet</p>
          <p style={{ margin: "0 0 24px", fontSize: "13px", color: "#9CA3AF", maxWidth: "340px", marginInline: "auto" }}>
            Assign courses to each grade and period to create Version 1. You can publish it once it's ready.
          </p>
          <button type="button" className="vc-btn-primary" onClick={() => setMode("new")}>+ Create Version 1</button>
        </div>
      )}

      {/* Two-column layout */}
      {mode !== "empty" && (
        <div className="vc-layout">
          {/* LEFT: main content */}
          <div style={{ minWidth: 0 }}>
            {(mode === "browse") && displayVersion && (
              <BrowsePanel
                version={displayVersion}
                curriculumPeriods={periods}
                ayPeriods={ayPeriods}
                nextVersionNumber={nextVersionNum}
                publishedId={published?.id}
                onPublish={handlePublish}
                onEdit={handleEdit}
                onNew={handleNew}
                onRestore={handleRestore}
                isPublishing={changingSt}
                isRestoring={creating}
              />
            )}

            {(mode === "new" || mode === "edit") && (
              <EditorPanel
                type={mode}
                curriculum={curriculum || { periods: [], structure: [] }}
                ayPeriods={ayPeriods}
                initialContent={editSource?.content || null}
                nextVersionNumber={nextVersionNum}
                onSave={handleSaveEditor}
                onCancel={handleCancelEditor}
                isPending={creating}
              />
            )}
          </div>

          {/* RIGHT: sidebar */}
          <VersionHistorySidebar
            published={published}
            history={history}
            focusedId={focusedVersion?.id}
            onSelect={handleSelectVersion}
          />
        </div>
      )}
    </div>
  );
}
