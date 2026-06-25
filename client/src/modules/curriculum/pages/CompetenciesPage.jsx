import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import {
  useLearningAreas,
  useCreateLearningArea,
  useUpdateLearningArea,
  useDeleteLearningArea,
  useCompetencies,
  useCreateCompetency,
  useUpdateCompetency,
  useDeleteCompetency,
  useLadder,
  useUpdateLadder,
  useAgeCategories,
  useCreateAgeCategory,
  useUpdateAgeCategory,
  useDeleteAgeCategory,
  useProgressLevels,
  useCreateProgressLevel,
  useUpdateProgressLevel,
  useDeleteProgressLevel,
  useAssessmentTypes,
  useCreateAssessmentType,
  useUpdateAssessmentType,
  useDeleteAssessmentType,
  useUpdateScoring,
  useEvidenceTypes,
  useCreateEvidenceType,
  useUpdateEvidenceType,
  useDeleteEvidenceType,
} from "../hooks/useCompetencies";

/* ── Constants ──────────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Academic Year" },
  { n: 4, label: "Version Control" },
  { n: 5, label: "Competencies" },
];

const AREA_COLORS = [
  "#25476a", "#38aae1", "#2e7db5", "#0A3880",
  "#059669", "#7C3AED", "#DC2626", "#D97706",
  "#0891B2", "#BE185D",
];

/* ── CSS ────────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes cp-fadein { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes cp-spin    { to { transform:rotate(360deg); } }

  .cp-steps { display:flex; align-items:center; justify-content:center; margin-bottom:32px; }
  .cp-connector { width:64px; height:2px; flex-shrink:0; margin:0 6px; margin-bottom:20px; }
  @media(max-width:640px){ .cp-connector{width:20px;} .cp-steps{justify-content:flex-start;overflow-x:auto;padding-bottom:4px;} }

  .cp-nav { display:flex; gap:6px; margin-bottom:24px; border-bottom:2px solid #F3F4F6; padding-bottom:0; }
  .cp-nav-btn {
    padding:9px 18px; background:none; border:none; border-bottom:2.5px solid transparent;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; color:#6B7280;
    cursor:pointer; margin-bottom:-2px; transition:color 0.15s, border-color 0.15s; white-space:nowrap;
  }
  .cp-nav-btn:hover  { color:#25476a; }
  .cp-nav-btn.active { color:#25476a; border-bottom-color:#25476a; }

  .cp-card {
    background:#fff; border-radius:16px; padding:22px 24px;
    box-shadow:0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04);
    animation:cp-fadein 0.18s ease;
  }

  .cp-list { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }

  .cp-item {
    display:flex; align-items:center; gap:12px;
    padding:11px 14px; border-radius:10px; border:1.5px solid #E5E7EB;
    background:#FAFAFA; transition:border-color 0.15s, background 0.15s;
  }
  .cp-item:hover { border-color:#b8d9ee; background:#F8FBFF; }

  .cp-item-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .cp-item-name { flex:1; min-width:0; font-size:13px; font-weight:600; color:#111827; }
  .cp-item-sub  { font-size:11px; color:#9CA3AF; font-weight:400; margin-top:1px; }
  .cp-item-badge {
    padding:2px 9px; border-radius:20px; font-size:10px; font-weight:700;
    background:#e8f5fb; color:#25476a; border:1px solid #a8d5ee; white-space:nowrap; flex-shrink:0;
  }

  .cp-icon-btn {
    width:30px; height:30px; border-radius:8px; border:none; background:transparent;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    color:#9CA3AF; transition:background 0.12s, color 0.12s; flex-shrink:0;
  }
  .cp-icon-btn:hover         { background:#F3F4F6; color:#374151; }
  .cp-icon-btn.danger:hover  { background:#FEF2F2; color:#DC2626; }

  .cp-form {
    background:#F0F7FF; border:1.5px solid #C7D9F8; border-radius:12px;
    padding:14px 16px; margin-bottom:16px; animation:cp-fadein 0.15s ease;
  }
  .cp-form-row { display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; }
  .cp-input {
    flex:1; min-width:140px; padding:8px 12px; border-radius:8px;
    border:1.5px solid #D1D5DB; font-size:13px; font-family:Inter,sans-serif;
    background:#fff; outline:none; transition:border-color 0.15s, box-shadow 0.15s;
  }
  .cp-input:focus { border-color:#25476a; box-shadow:0 0 0 3px rgba(37,71,106,0.08); }
  .cp-textarea {
    width:100%; padding:8px 12px; border-radius:8px; border:1.5px solid #D1D5DB;
    font-size:13px; font-family:Inter,sans-serif; background:#fff; outline:none;
    resize:vertical; min-height:64px; margin-top:8px; box-sizing:border-box;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .cp-textarea:focus { border-color:#25476a; box-shadow:0 0 0 3px rgba(37,71,106,0.08); }

  .cp-select {
    padding:8px 12px; border-radius:8px; border:1.5px solid #D1D5DB;
    font-size:13px; font-family:Inter,sans-serif; background:#fff; outline:none;
    cursor:pointer; transition:border-color 0.15s;
  }
  .cp-select:focus { border-color:#25476a; }

  .cp-btn-primary {
    padding:8px 18px; background:#25476a; color:#fff; border:none; border-radius:9px;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer;
    display:inline-flex; align-items:center; gap:7px; transition:background 0.15s; white-space:nowrap;
  }
  .cp-btn-primary:hover:not(:disabled) { background:#0A3880; }
  .cp-btn-primary:disabled { background:#b8d9ee; cursor:not-allowed; }

  .cp-btn-secondary {
    padding:8px 16px; background:#fff; color:#374151; border:1.5px solid #E5E7EB;
    border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; display:inline-flex; align-items:center; gap:6px;
    transition:all 0.15s; white-space:nowrap;
  }
  .cp-btn-secondary:hover { background:#F3F4F6; }

  .cp-btn-ghost {
    padding:8px 16px; background:#e8f5fb; color:#25476a; border:1.5px solid #a8d5ee;
    border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; display:inline-flex; align-items:center; gap:6px;
    transition:all 0.15s; white-space:nowrap;
  }
  .cp-btn-ghost:hover { background:#d6edf8; }

  .cp-btn-add {
    display:inline-flex; align-items:center; gap:6px; padding:8px 16px;
    background:transparent; border:1.5px dashed #D1D5DB; border-radius:9px;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; color:#6B7280;
    cursor:pointer; transition:all 0.15s;
  }
  .cp-btn-add:hover { border-color:#25476a; color:#25476a; background:#e8f5fb; }

  .cp-empty {
    text-align:center; padding:48px 24px; background:#FAFAFA;
    border:2px dashed #E5E7EB; border-radius:14px;
    animation:cp-fadein 0.2s ease;
  }

  /* Color swatches */
  .cp-swatches { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .cp-swatch {
    width:24px; height:24px; border-radius:50%; cursor:pointer;
    border:2px solid transparent; transition:transform 0.1s, border-color 0.1s;
    flex-shrink:0;
  }
  .cp-swatch:hover  { transform:scale(1.15); }
  .cp-swatch.active { border-color:#111827; transform:scale(1.15); }

  /* Ladder */
  .cp-rung {
    border:1.5px solid #E5E7EB; border-radius:14px; overflow:hidden; margin-bottom:12px;
    transition:border-color 0.15s;
  }
  .cp-rung:hover { border-color:#b8d9ee; }
  .cp-rung-head {
    display:flex; align-items:center; gap:12px; padding:12px 16px;
    background:linear-gradient(135deg,#0A3880,#25476a); cursor:pointer;
  }
  .cp-rung-body { padding:14px 16px; background:#fff; }

  .cp-assign-chip {
    display:inline-flex; align-items:center; gap:6px; padding:4px 10px;
    border-radius:20px; font-size:11px; font-weight:600;
    background:#e8f5fb; border:1.5px solid #a8d5ee; color:#25476a;
    font-family:Inter,sans-serif; margin:3px;
  }
  .cp-chip-x {
    width:14px; height:14px; border-radius:50%; border:none;
    background:rgba(29,58,138,0.1); color:#25476a; cursor:pointer;
    display:inline-flex; align-items:center; justify-content:center;
    font-size:10px; font-weight:900; padding:0; flex-shrink:0;
    transition:background 0.1s, color 0.1s;
  }
  .cp-chip-x:hover { background:rgba(239,68,68,0.2); color:#DC2626; }

  .cp-spinner {
    width:20px; height:20px; border:2.5px solid #E5E7EB; border-top-color:#25476a;
    border-radius:50%; animation:cp-spin 0.7s linear infinite; margin:0 auto;
  }

  /* ── Competency card grid ── */
  .cp-comp-grid {
    display:grid;
    grid-template-columns:repeat(auto-fill, minmax(248px,1fr));
    gap:14px;
  }
  @media(max-width:580px){ .cp-comp-grid{ grid-template-columns:1fr; } }

  .cp-comp-card {
    background:#fff; border:1.5px solid #E5E7EB; border-radius:14px;
    padding:18px; display:flex; flex-direction:column; min-height:130px;
    transition:border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .cp-comp-card:hover {
    border-color:#b8d9ee;
    box-shadow:0 4px 16px rgba(37,71,106,0.09);
    transform:translateY(-2px);
  }
  .cp-comp-card--editing {
    border-color:#25476a !important;
    box-shadow:0 0 0 3px rgba(37,71,106,0.1) !important;
  }
  .cp-comp-card--add {
    border:1.5px dashed #D1D5DB; background:#FAFAFA;
    align-items:center; justify-content:center; cursor:pointer;
    min-height:130px;
  }
  .cp-comp-card--add:hover { border-color:#25476a; background:#e8f5fb; }
  .cp-comp-card--add:hover .cp-add-card-icon { border-color:#a8d5ee; color:#25476a; }
  .cp-comp-card--add:hover .cp-add-card-label { color:#25476a; }

  .cp-add-card-icon {
    width:40px; height:40px; border-radius:12px; border:2px dashed #D1D5DB;
    display:flex; align-items:center; justify-content:center; color:#C4C9D4;
    transition:border-color 0.15s, color 0.15s; margin-bottom:8px;
  }
  .cp-add-card-label { font-size:13px; font-weight:600; color:#9CA3AF; transition:color 0.15s; }

  /* Card kebab */
  .cp-card-kebab-btn {
    width:28px; height:28px; border-radius:7px; border:none; background:transparent;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    color:#D1D5DB; transition:background 0.12s, color 0.12s; flex-shrink:0;
  }
  .cp-card-kebab-btn:hover { background:#F3F4F6; color:#374151; }

  .cp-card-menu {
    position:absolute; top:calc(100% + 4px); right:0; z-index:200;
    background:#fff; border:1px solid #E5E7EB; border-radius:10px;
    box-shadow:0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06);
    min-width:136px; padding:4px;
    animation:cp-fadein 0.12s ease;
  }
  .cp-card-menu-item {
    display:flex; align-items:center; gap:8px; width:100%;
    padding:8px 10px; border:none; border-radius:7px; background:transparent;
    font-size:12px; font-weight:600; font-family:Inter,sans-serif; color:#374151;
    cursor:pointer; text-align:left; transition:background 0.1s, color 0.1s;
  }
  .cp-card-menu-item:hover { background:#F3F4F6; color:#111827; }
  .cp-card-menu-item--danger { color:#DC2626; }
  .cp-card-menu-item--danger:hover { background:#FEF2F2; }

  /* ── Add / Edit form card ── */
  .cp-comp-form-card {
    background:linear-gradient(135deg,#f0f7ff 0%,#fafcff 100%);
    border:1.5px solid #C7D9F8; border-radius:14px;
    padding:20px 22px; margin-bottom:20px;
    animation:cp-fadein 0.15s ease;
  }
  .cp-field-label { font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px; }
  .cp-field-label .cp-required { color:#DC2626; }
  .cp-field-label .cp-optional { font-weight:400; color:#9CA3AF; }
  .cp-char-count { font-size:10px; color:#9CA3AF; text-align:right; margin-top:3px; }

  /* ── Progress Arc nav dropdown ── */
  .cp-arc-tab { position:relative; }
  .cp-arc-dropdown {
    position:absolute; top:calc(100% + 8px); left:0; z-index:400;
    background:#fff; border:1px solid #E5E7EB; border-radius:12px;
    box-shadow:0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    min-width:200px; padding:6px;
    animation:cp-fadein 0.13s ease;
  }
  .cp-arc-dropdown-item {
    display:flex; align-items:center; gap:10px; width:100%;
    padding:11px 13px; border:none; border-radius:9px; background:transparent;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; color:#374151;
    cursor:pointer; text-align:left; transition:background 0.1s, color 0.1s;
  }
  .cp-arc-dropdown-item:hover  { background:#F0F7FF; color:#25476a; }
  .cp-arc-dropdown-item.active { background:#e8f5fb; color:#25476a; }
  .cp-arc-dropdown-divider { height:1px; background:#F3F4F6; margin:4px 0; }
  .cp-arc-subbadge {
    font-size:10px; font-weight:700; padding:2px 7px; border-radius:20px;
    background:#e8f5fb; color:#25476a; border:1px solid #a8d5ee; white-space:nowrap;
  }

  /* ── Progress Arc sub-panel header ── */
  .cp-arc-section-header {
    display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;
    padding-bottom:16px; border-bottom:1.5px solid #F3F4F6;
  }
  .cp-arc-section-nav {
    display:flex; gap:4px;
  }
  .cp-arc-section-btn {
    padding:7px 14px; background:none; border:none; border-radius:8px;
    font-size:12px; font-weight:600; font-family:Inter,sans-serif; color:#9CA3AF;
    cursor:pointer; transition:background 0.12s, color 0.12s;
  }
  .cp-arc-section-btn:hover  { background:#F3F4F6; color:#374151; }
  .cp-arc-section-btn.active { background:#25476a; color:#fff; }

  /* Assessment type badges */
  .cp-type-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700;
    text-transform:capitalize; white-space:nowrap; flex-shrink:0;
    font-family:Inter,sans-serif;
  }
  .cp-type-formative   { background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; }
  .cp-type-summative   { background:#F0FDF4; color:#15803D; border:1px solid #BBF7D0; }
  .cp-type-diagnostic  { background:#FFF7ED; color:#C2410C; border:1px solid #FED7AA; }
  .cp-type-project     { background:#F5F3FF; color:#6D28D9; border:1px solid #DDD6FE; }

  /* Read-only competency card in arc */
  .cp-arc-comp-card {
    background:#fff; border:1.5px solid #E5E7EB; border-radius:14px;
    padding:16px; display:flex; flex-direction:column; min-height:110px;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .cp-arc-comp-card:hover { border-color:#b8d9ee; box-shadow:0 2px 10px rgba(37,71,106,0.07); }
`;

/* ── Step Indicator ─────────────────────────────────────────────────────── */

function StepIndicator({ current }) {
  return (
    <div className="cp-steps">
      {STEPS.map((step, i) => {
        const done = step.n < current, active = step.n === current;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%",
                backgroundColor: done || active ? "#25476a" : "#F3F4F6",
                border: `2.5px solid ${done || active ? "#25476a" : "#E5E7EB"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || active ? "#fff" : "#9CA3AF",
                fontSize: done ? "15px" : "13px", fontWeight: "700", flexShrink: 0,
                boxShadow: active ? "0 0 0 4px rgba(37,71,106,0.1)" : "none",
              }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{
                fontSize: "11px", fontWeight: active ? "700" : "400",
                color: active ? "#25476a" : done ? "#374151" : "#9CA3AF", whiteSpace: "nowrap",
              }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="cp-connector" style={{ backgroundColor: done ? "#25476a" : "#E5E7EB" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── LearningAreasPanel ─────────────────────────────────────────────────── */

function LearningAreasPanel({ curriculumId }) {
  const { data: areas = [], isLoading } = useLearningAreas(curriculumId);
  const { mutate: create, isPending: creating } = useCreateLearningArea(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateLearningArea(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteLearningArea(curriculumId);

  const [showForm, setShowForm]   = useState(false);
  const [editId,   setEditId]     = useState(null);
  const [name,     setName]       = useState("");
  const [desc,     setDesc]       = useState("");
  const [color,    setColor]      = useState(AREA_COLORS[0]);
  const nameRef = useRef(null);

  useEffect(() => { if (showForm) nameRef.current?.focus(); }, [showForm]);

  function openCreate() {
    setEditId(null); setName(""); setDesc(""); setColor(AREA_COLORS[0]); setShowForm(true);
  }
  function openEdit(area) {
    setEditId(area.id); setName(area.name); setDesc(area.description || ""); setColor(area.color || AREA_COLORS[0]); setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditId(null); }

  function submit() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: desc.trim(), color };
    if (editId) {
      update({ id: editId, data }, { onSuccess: cancel });
    } else {
      create(data, { onSuccess: cancel });
    }
  }

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "32px" }} />;

  return (
    <div className="cp-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Learning Areas</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {areas.length} area{areas.length !== 1 ? "s" : ""} — broad domains that group competencies (e.g. Language, STEM, Arts)
          </p>
        </div>
        {!showForm && (
          <button type="button" className="cp-btn-add" onClick={openCreate}>
            + Add Area
          </button>
        )}
      </div>

      {showForm && (
        <div className="cp-form">
          <div className="cp-form-row">
            <input
              ref={nameRef}
              className="cp-input"
              placeholder="Area name (e.g. Language & Literacy)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
            />
          </div>
          <textarea
            className="cp-textarea"
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
          />
          <div className="cp-swatches">
            {AREA_COLORS.map((c) => (
              <button
                key={c} type="button" className={`cp-swatch${color === c ? " active" : ""}`}
                style={{ backgroundColor: c }} onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button type="button" className="cp-btn-primary" onClick={submit} disabled={creating || updating || !name.trim()}>
              {creating || updating ? "Saving…" : editId ? "Update" : "Create"}
            </button>
            <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {areas.length === 0 && !showForm ? (
        <div className="cp-empty">
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>📂</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No learning areas yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF" }}>Group your competencies under broad learning areas.</p>
          <button type="button" className="cp-btn-ghost" onClick={openCreate}>+ Add First Area</button>
        </div>
      ) : (
        <div className="cp-list">
          {areas.map((area) => (
            <div key={area.id} className="cp-item">
              <div className="cp-item-dot" style={{ backgroundColor: area.color || "#25476a" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cp-item-name">{area.name}</div>
                {area.description && <div className="cp-item-sub">{area.description}</div>}
              </div>
              <button type="button" className="cp-icon-btn" onClick={() => openEdit(area)} title="Edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button type="button" className="cp-icon-btn danger" onClick={() => remove(area.id)} disabled={deleting} title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── CardKebab ──────────────────────────────────────────────────────────── */

function CardKebab({ onEdit, onDelete, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        className="cp-card-kebab-btn"
        onClick={() => setOpen((v) => !v)}
        title="Options"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
        </svg>
      </button>

      {open && (
        <div className="cp-card-menu">
          <button
            type="button"
            className="cp-card-menu-item"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Edit
          </button>
          <button
            type="button"
            className="cp-card-menu-item cp-card-menu-item--danger"
            onClick={() => { setOpen(false); onDelete(); }}
            disabled={disabled}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ── CompetenciesPanel ──────────────────────────────────────────────────── */

const COMP_PALETTE = [
  "#25476a","#38aae1","#059669","#7C3AED",
  "#DC2626","#D97706","#0891B2","#BE185D",
  "#2e7db5","#0A3880",
];

function CompetenciesPanel({ curriculumId }) {
  const { data: areas = [] }            = useLearningAreas(curriculumId);
  const { data: comps = [], isLoading } = useCompetencies(curriculumId);
  const { mutate: create, isPending: creating } = useCreateCompetency(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateCompetency(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteCompetency(curriculumId);

  const [mode,       setMode]       = useState("list"); // "list" | "add" | "edit"
  const [editTarget, setEditTarget] = useState(null);
  const [name,       setName]       = useState("");
  const [desc,       setDesc]       = useState("");
  const [areaId,     setAreaId]     = useState("");
  const nameRef = useRef(null);

  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd() {
    setEditTarget(null); setName(""); setDesc(""); setAreaId(""); setMode("add");
  }
  function openEdit(comp) {
    setEditTarget(comp);
    setName(comp.name);
    setDesc(comp.description || "");
    setAreaId(comp.learningAreaId || "");
    setMode("edit");
  }
  function cancelForm() { setMode("list"); setEditTarget(null); }

  function submit() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: desc.trim(), learningAreaId: areaId || null };
    if (mode === "edit") {
      update({ id: editTarget.id, data }, { onSuccess: cancelForm });
    } else {
      create(data, {
        onSuccess: () => { setName(""); setDesc(""); setAreaId(""); nameRef.current?.focus(); },
      });
    }
  }

  const areaMap = Object.fromEntries(areas.map((a) => [a.id, a]));

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;

  return (
    <div className="cp-card">

      {/* ── Panel header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Competencies</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {comps.length === 0
              ? "Core capabilities learners will develop through this curriculum"
              : `${comps.length} competenc${comps.length !== 1 ? "ies" : "y"} defined`}
          </p>
        </div>
        {mode === "list" && (
          <button type="button" className="cp-btn-primary" onClick={openAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Add Competency
          </button>
        )}
      </div>

      {/* ── Add / Edit form ───────────────────────────────────────── */}
      {mode !== "list" && (
        <div className="cp-comp-form-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0F2645" }}>
                {mode === "edit" ? "Edit Competency" : "New Competency"}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                {mode === "edit" ? "Update the name or description below." : "Fill in the details and click Add."}
              </p>
            </div>
            <button type="button" className="cp-icon-btn" onClick={cancelForm} title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {/* Name */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="cp-field-label">
                Name <span className="cp-required">*</span>
              </label>
              <input
                ref={nameRef}
                className="cp-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="e.g. Critical Thinking, Communication, Creativity…"
                value={name}
                maxLength={150}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(); if (e.key === "Escape") cancelForm(); }}
              />
              <div className="cp-char-count">{name.length} / 150</div>
            </div>

            {/* Description */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="cp-field-label">
                Description <span className="cp-optional">(optional)</span>
              </label>
              <textarea
                className="cp-textarea"
                placeholder="What does this competency mean? What skills, behaviours, or attitudes does it encompass?"
                value={desc}
                maxLength={500}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
              />
              <div className="cp-char-count">{desc.length} / 500</div>
            </div>

            {/* Learning area (only if areas exist) */}
            {areas.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="cp-field-label">
                  Learning Area <span className="cp-optional">(optional)</span>
                </label>
                <select
                  className="cp-select"
                  style={{ width: "100%", marginTop: "0" }}
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                >
                  <option value="">No area assigned</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "18px" }}>
            <button
              type="button"
              className="cp-btn-primary"
              onClick={submit}
              disabled={creating || updating || !name.trim()}
            >
              {creating || updating
                ? "Saving…"
                : mode === "edit"
                  ? "Save Changes"
                  : "Add Competency"}
            </button>
            <button type="button" className="cp-btn-secondary" onClick={cancelForm}>Cancel</button>
            {mode === "add" && (
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "#9CA3AF" }}>
                Press Enter to add
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────── */}
      {comps.length === 0 && mode === "list" && (
        <div className="cp-empty">
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎯</div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>
            No competencies yet
          </p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "340px", marginInline: "auto", lineHeight: "1.6" }}>
            Competencies are the core capabilities learners develop. Add your first one to get started.
          </p>
          <button type="button" className="cp-btn-ghost" onClick={openAdd}>
            + Add First Competency
          </button>
        </div>
      )}

      {/* ── Card grid ────────────────────────────────────────────── */}
      {comps.length > 0 && (
        <div className="cp-comp-grid">
          {comps.map((comp, idx) => {
            const area       = areaMap[comp.learningAreaId];
            const color      = area?.color || COMP_PALETTE[idx % COMP_PALETTE.length];
            const initial    = comp.name.charAt(0).toUpperCase();
            const isEditing  = mode === "edit" && editTarget?.id === comp.id;

            return (
              <div
                key={comp.id}
                className={`cp-comp-card${isEditing ? " cp-comp-card--editing" : ""}`}
              >
                {/* Top: initial + name + area badge + kebab */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
                    backgroundColor: `${color}15`, border: `2px solid ${color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "17px", fontWeight: "800", color,
                  }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", lineHeight: 1.35, wordBreak: "break-word" }}>
                      {comp.name}
                    </p>
                    {area ? (
                      <span style={{
                        display: "inline-block", marginTop: "5px",
                        padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "700",
                        backgroundColor: `${color}12`, color, border: `1px solid ${color}28`,
                      }}>
                        {area.name}
                      </span>
                    ) : (
                      <span style={{ display: "inline-block", marginTop: "5px", fontSize: "10px", color: "#D1D5DB" }}>
                        No area
                      </span>
                    )}
                  </div>
                  <CardKebab
                    onEdit={() => openEdit(comp)}
                    onDelete={() => remove(comp.id)}
                    disabled={deleting}
                  />
                </div>

                {/* Description */}
                <div style={{ flex: 1 }}>
                  {comp.description ? (
                    <p style={{
                      margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.65",
                      display: "-webkit-box", WebkitLineClamp: 4,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {comp.description}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>
                      No description added
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Inline add card — quick entry when cards already exist */}
          {mode === "list" && (
            <button type="button" className="cp-comp-card cp-comp-card--add" onClick={openAdd}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div className="cp-add-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="cp-add-card-label">Add Competency</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── ProgressionLadderPanel ─────────────────────────────────────────────── */

function ProgressionLadderPanel({ curriculumId }) {
  const { data: comps  = [] }           = useCompetencies(curriculumId);
  const { data: rungs  = [], isLoading } = useLadder(curriculumId);
  const { mutate: save, isPending: saving } = useUpdateLadder(curriculumId);

  const [localRungs, setLocalRungs] = useState([]);
  const [openIdx, setOpenIdx]       = useState(0);
  const [pickingFor, setPickingFor] = useState(null);
  const [editLabelIdx, setEditLabelIdx] = useState(null);
  const [labelDraft, setLabelDraft]    = useState("");
  const labelRef = useRef(null);

  useEffect(() => { setLocalRungs(rungs.map((r) => ({ ...r, assignments: [...(r.assignments || [])] }))); }, [rungs]);
  useEffect(() => { if (editLabelIdx !== null) labelRef.current?.focus(); }, [editLabelIdx]);

  const assignedIds = (rung) => (rung.assignments || []).map((a) => a.competencyId);

  function addAssignment(rungIdx, compId) {
    const updated = localRungs.map((r, i) => {
      if (i !== rungIdx) return r;
      return { ...r, assignments: [...r.assignments, { competencyId: compId, descriptor: "" }] };
    });
    setLocalRungs(updated);
    setPickingFor(null);
  }

  function removeAssignment(rungIdx, compId) {
    const updated = localRungs.map((r, i) => {
      if (i !== rungIdx) return r;
      return { ...r, assignments: r.assignments.filter((a) => a.competencyId !== compId) };
    });
    setLocalRungs(updated);
  }

  function setDescriptor(rungIdx, compId, descriptor) {
    const updated = localRungs.map((r, i) => {
      if (i !== rungIdx) return r;
      return {
        ...r,
        assignments: r.assignments.map((a) =>
          a.competencyId === compId ? { ...a, descriptor } : a
        ),
      };
    });
    setLocalRungs(updated);
  }

  function startEditLabel(idx) {
    setEditLabelIdx(idx);
    setLabelDraft(localRungs[idx].label);
  }

  function commitLabel() {
    if (editLabelIdx === null) return;
    if (labelDraft.trim()) {
      setLocalRungs((prev) => prev.map((r, i) => i === editLabelIdx ? { ...r, label: labelDraft.trim() } : r));
    }
    setEditLabelIdx(null);
  }

  function handleSave() {
    save(localRungs);
  }

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "32px" }} />;

  return (
    <div className="cp-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Progress Arc</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            Five preset age stages. Assign competencies and add a descriptor for each stage.
          </p>
        </div>
        <button type="button" className="cp-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Arc"}
        </button>
      </div>

      {comps.length === 0 && (
        <div style={{ margin: "12px 0 20px", padding: "10px 14px", background: "#FFF8E6", border: "1px solid #FCD97A", borderRadius: "10px", fontSize: "13px", color: "#92400E" }}>
          Go to <strong>Competencies</strong> tab first to define competencies, then assign them here.
        </div>
      )}

      <div style={{ marginTop: "16px" }}>
        {localRungs.map((rung, rungIdx) => {
          const isOpen     = openIdx === rungIdx;
          const assigned   = assignedIds(rung);
          const available  = comps.filter((c) => !assigned.includes(c.id));
          const isPicking  = pickingFor === rungIdx;

          return (
            <div key={rung.id} className="cp-rung">
              {/* Rung header */}
              <div className="cp-rung-head" onClick={() => setOpenIdx(isOpen ? -1 : rungIdx)}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800", color: "#fff", flexShrink: 0 }}>
                  {rung.order}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editLabelIdx === rungIdx ? (
                    <input
                      ref={labelRef}
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onBlur={commitLabel}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") commitLabel(); e.stopPropagation(); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: "6px", color: "#fff", fontSize: "14px", fontWeight: "700", fontFamily: "Inter,sans-serif", padding: "3px 8px", outline: "none", width: "200px" }}
                    />
                  ) : (
                    <span
                      style={{ fontSize: "14px", fontWeight: "700", color: "#fff", cursor: "text" }}
                      onClick={(e) => { e.stopPropagation(); startEditLabel(rungIdx); }}
                      title="Click to rename"
                    >
                      {rung.label}
                    </span>
                  )}
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", marginTop: "1px" }}>{rung.ageRange}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 8px", borderRadius: "20px" }}>
                    {assigned.length} competenc{assigned.length !== 1 ? "ies" : "y"}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: "rgba(255,255,255,0.7)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Rung body */}
              {isOpen && (
                <div className="cp-rung-body">
                  {/* Assigned chips */}
                  <div style={{ marginBottom: "12px" }}>
                    {rung.assignments.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No competencies assigned to this stage yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                        {rung.assignments.map((a) => {
                          const comp = comps.find((c) => c.id === a.competencyId);
                          if (!comp) return null;
                          return (
                            <span key={a.competencyId} className="cp-assign-chip">
                              {comp.name}
                              <button type="button" className="cp-chip-x" onClick={() => removeAssignment(rungIdx, a.competencyId)}>×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Descriptors */}
                  {rung.assignments.length > 0 && (
                    <div style={{ marginBottom: "14px" }}>
                      <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: "600", color: "#374151" }}>Descriptors — what does each competency look like at this stage?</p>
                      {rung.assignments.map((a) => {
                        const comp = comps.find((c) => c.id === a.competencyId);
                        if (!comp) return null;
                        return (
                          <div key={a.competencyId} style={{ marginBottom: "8px" }}>
                            <label style={{ fontSize: "11px", fontWeight: "700", color: "#6B7280", display: "block", marginBottom: "3px" }}>{comp.name}</label>
                            <input
                              className="cp-input"
                              style={{ width: "100%", boxSizing: "border-box" }}
                              placeholder={`What does ${comp.name} look like at this stage?`}
                              value={a.descriptor || ""}
                              onChange={(e) => setDescriptor(rungIdx, a.competencyId, e.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Assign picker */}
                  {available.length > 0 && !isPicking && (
                    <button type="button" className="cp-btn-add" style={{ fontSize: "12px", padding: "6px 12px" }} onClick={() => setPickingFor(rungIdx)}>
                      + Assign Competency
                    </button>
                  )}
                  {isPicking && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "10px 12px", background: "#F0F7FF", borderRadius: "10px", border: "1.5px solid #C7D9F8" }}>
                      <select
                        className="cp-select"
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) addAssignment(rungIdx, e.target.value); }}
                        autoFocus
                      >
                        <option value="" disabled>Pick a competency…</option>
                        {available.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button type="button" className="cp-btn-secondary" style={{ fontSize: "12px", padding: "6px 12px" }} onClick={() => setPickingFor(null)}>Cancel</button>
                    </div>
                  )}
                  {available.length === 0 && assigned.length > 0 && (
                    <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>All competencies are assigned to this stage.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Assessment Framework helpers ───────────────────────────────────────── */

function CrudPanel({ title, subtitle, emptyIcon, emptyTitle, emptyText, addLabel, items, isLoading, onAdd, renderCard, mode, formContent, formTitle }) {
  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>{title}</h3>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>{subtitle}</p>
        </div>
        {mode === "list" && (
          <button type="button" className="cp-btn-primary" onClick={onAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            {addLabel}
          </button>
        )}
      </div>
      {mode !== "list" && formContent}
      {items.length === 0 && mode === "list" ? (
        <div className="cp-empty">
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>{emptyIcon}</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>{emptyTitle}</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF", maxWidth: "300px", marginInline: "auto" }}>{emptyText}</p>
          <button type="button" className="cp-btn-ghost" onClick={onAdd}>+ {addLabel}</button>
        </div>
      ) : (
        <div className="cp-comp-grid">
          {items.map(renderCard)}
          {mode === "list" && (
            <button type="button" className="cp-comp-card cp-comp-card--add" onClick={onAdd}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div className="cp-add-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                </div>
                <span className="cp-add-card-label">{addLabel}</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── AssessmentTypesSubPanel ─────────────────────────────────────────────── */

function AssessmentTypesSubPanel({ curriculumId }) {
  const { data: types = [], isLoading } = useAssessmentTypes(curriculumId);
  const { mutate: create, isPending: creating } = useCreateAssessmentType(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateAssessmentType(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteAssessmentType(curriculumId);

  const [mode, setMode]         = useState("list");
  const [editTarget, setEdit]   = useState(null);
  const [name, setName]         = useState("");
  const [desc, setDesc]         = useState("");
  const nameRef = useRef(null);
  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()  { setEdit(null); setName(""); setDesc(""); setMode("add"); }
  function openEdit(t){ setEdit(t); setName(t.name); setDesc(t.description || ""); setMode("edit"); }
  function cancel()   { setMode("list"); setEdit(null); }
  function submit() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: desc.trim() };
    if (mode === "edit") update({ id: editTarget.id, data }, { onSuccess: cancel });
    else create(data, { onSuccess: () => { setName(""); setDesc(""); nameRef.current?.focus(); } });
  }

  const form = (
    <div className="cp-comp-form-card" style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>{mode === "edit" ? "Edit Type" : "New Assessment Type"}</h3>
        <button type="button" className="cp-icon-btn" onClick={cancel}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label className="cp-field-label">Name <span className="cp-required">*</span></label>
          <input ref={nameRef} className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="e.g. Continuous Assessment, End of Term Test…"
            value={name} maxLength={150}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
          />
          <div className="cp-char-count">{name.length} / 150</div>
        </div>
        <div>
          <label className="cp-field-label">Description <span className="cp-optional">(optional)</span></label>
          <textarea className="cp-textarea" rows={3} placeholder="What is this assessment type used for?" value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} />
          <div className="cp-char-count">{desc.length} / 1000</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <button type="button" className="cp-btn-primary" onClick={submit} disabled={(creating || updating) || !name.trim()}>
          {creating || updating ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Type"}
        </button>
        <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );

  return (
    <CrudPanel
      title="Assessment Types" subtitle={types.length === 0 ? "Define the categories of assessment used in this curriculum" : `${types.length} type${types.length !== 1 ? "s" : ""} defined`}
      emptyIcon="📋" emptyTitle="No assessment types yet" addLabel="Add Type" mode={mode} onAdd={openAdd} formContent={form} items={types}
      emptyText="Create assessment types like 'Continuous Assessment' or 'End of Term Test'."
      renderCard={(t, idx) => {
        const color = COMP_PALETTE[idx % COMP_PALETTE.length];
        return (
          <div key={t.id} className={`cp-comp-card${mode === "edit" && editTarget?.id === t.id ? " cp-comp-card--editing" : ""}`}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0, backgroundColor: `${color}15`, border: `2px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: "800", color }}>
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", lineHeight: 1.35 }}>{t.name}</p>
                {(t.evidenceWeights || []).length > 0 && (
                  <span style={{ display: "inline-block", marginTop: "4px", fontSize: "10px", fontWeight: "600", color: "#059669" }}>
                    {(t.evidenceWeights || []).length} evidence type{(t.evidenceWeights || []).length !== 1 ? "s" : ""} scored
                  </span>
                )}
              </div>
              <CardKebab onEdit={() => openEdit(t)} onDelete={() => remove(t.id)} disabled={deleting} />
            </div>
            <div style={{ flex: 1 }}>
              {t.description ? (
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.65", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.description}</p>
              ) : (
                <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No description</p>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}

/* ── EvidenceTypesSubPanel ───────────────────────────────────────────────── */

const EVIDENCE_PALETTE = ["#0891B2","#7C3AED","#059669","#D97706","#DC2626","#BE185D","#25476a","#38aae1","#2e7db5","#0A3880"];

function EvidenceTypesSubPanel({ curriculumId }) {
  const { data: evidences = [], isLoading } = useEvidenceTypes(curriculumId);
  const { mutate: create, isPending: creating } = useCreateEvidenceType(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateEvidenceType(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteEvidenceType(curriculumId);

  const [mode, setMode]       = useState("list");
  const [editTarget, setEdit] = useState(null);
  const [name, setName]       = useState("");
  const [desc, setDesc]       = useState("");
  const nameRef = useRef(null);
  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()  { setEdit(null); setName(""); setDesc(""); setMode("add"); }
  function openEdit(e){ setEdit(e); setName(e.name); setDesc(e.description || ""); setMode("edit"); }
  function cancel()   { setMode("list"); setEdit(null); }
  function submit() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: desc.trim() };
    if (mode === "edit") update({ id: editTarget.id, data }, { onSuccess: cancel });
    else create(data, { onSuccess: () => { setName(""); setDesc(""); nameRef.current?.focus(); } });
  }

  const form = (
    <div className="cp-comp-form-card" style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>{mode === "edit" ? "Edit Evidence Type" : "New Evidence Type"}</h3>
        <button type="button" className="cp-icon-btn" onClick={cancel}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label className="cp-field-label">Name <span className="cp-required">*</span></label>
          <input ref={nameRef} className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="e.g. Quiz, Assignment, Project, Teacher Observation…"
            value={name} maxLength={150}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
          />
          <div className="cp-char-count">{name.length} / 150</div>
        </div>
        <div>
          <label className="cp-field-label">Description <span className="cp-optional">(optional)</span></label>
          <textarea className="cp-textarea" rows={2} placeholder="Briefly describe what this evidence type involves…" value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} />
          <div className="cp-char-count">{desc.length} / 500</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <button type="button" className="cp-btn-primary" onClick={submit} disabled={(creating || updating) || !name.trim()}>
          {creating || updating ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Evidence Type"}
        </button>
        <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );

  return (
    <CrudPanel
      title="Evidence Types" subtitle={evidences.length === 0 ? "Define the evidence methods used to assess learning" : `${evidences.length} evidence type${evidences.length !== 1 ? "s" : ""} defined`}
      emptyIcon="🔬" emptyTitle="No evidence types yet" addLabel="Add Evidence Type" mode={mode} onAdd={openAdd} formContent={form} items={evidences}
      emptyText="Add evidence types like Quiz, Assignment, Project, or Teacher Observation."
      renderCard={(e, idx) => {
        const color = EVIDENCE_PALETTE[idx % EVIDENCE_PALETTE.length];
        return (
          <div key={e.id} className={`cp-comp-card${mode === "edit" && editTarget?.id === e.id ? " cp-comp-card--editing" : ""}`}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0, backgroundColor: `${color}15`, border: `2px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: "800", color }}>
                {e.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", lineHeight: 1.35 }}>{e.name}</p>
              </div>
              <CardKebab onEdit={() => openEdit(e)} onDelete={() => remove(e.id)} disabled={deleting} />
            </div>
            <div style={{ flex: 1 }}>
              {e.description ? (
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.65", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.description}</p>
              ) : (
                <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No description</p>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}

/* ── ScoringSubPanel ─────────────────────────────────────────────────────── */

function ScoringCard({ assessmentType, evidences, onSave, saving }) {
  const [weights, setWeights] = useState(() =>
    (assessmentType.evidenceWeights || []).map((w) => ({ ...w }))
  );
  const [adding, setAdding] = useState(false);
  const [pickId, setPickId] = useState("");

  const total = weights.reduce((s, w) => s + (Number(w.weight) || 0), 0);
  const isComplete = total === 100;
  const isOver     = total > 100;
  const evidenceMap = Object.fromEntries(evidences.map((e) => [e.id, e]));
  const assignedIds = weights.map((w) => w.evidenceTypeId);
  const available   = evidences.filter((e) => !assignedIds.includes(e.id));

  function addEvidence() {
    if (!pickId) return;
    setWeights((prev) => [...prev, { evidenceTypeId: pickId, weight: 0 }]);
    setPickId("");
    setAdding(false);
  }

  function removeEvidence(etId) {
    setWeights((prev) => prev.filter((w) => w.evidenceTypeId !== etId));
  }

  function changeWeight(etId, val) {
    setWeights((prev) => prev.map((w) => w.evidenceTypeId === etId ? { ...w, weight: Number(val) } : w));
  }

  function handleSave() {
    onSave({ id: assessmentType.id, evidenceWeights: weights });
  }

  const isDirty = JSON.stringify(weights) !== JSON.stringify(assessmentType.evidenceWeights || []);

  return (
    <div style={{
      background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "16px",
      padding: "20px 22px", marginBottom: "14px",
      transition: "border-color 0.15s, box-shadow 0.15s",
      boxShadow: isDirty ? "0 0 0 3px rgba(37,71,106,0.08)" : "none",
      borderColor: isDirty ? "#25476a" : "#E5E7EB",
    }}>
      {/* Card header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0F2645" }}>{assessmentType.name}</h4>
          {assessmentType.description && (
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>{assessmentType.description}</p>
          )}
        </div>
        {/* Total indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "12px",
          padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700",
          background: isComplete ? "#F0FDF4" : isOver ? "#FEF2F2" : "#FFF7ED",
          color: isComplete ? "#15803D" : isOver ? "#DC2626" : "#C2410C",
          border: `1px solid ${isComplete ? "#BBF7D0" : isOver ? "#FECACA" : "#FED7AA"}`,
        }}>
          {isComplete ? "✓" : isOver ? "!" : "◷"} {total}%
        </div>
      </div>

      {/* Weight rows */}
      {weights.length === 0 ? (
        <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#9CA3AF" }}>No evidence types assigned yet. Add some below.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
          {weights.map((w) => {
            const ev    = evidenceMap[w.evidenceTypeId];
            if (!ev) return null;
            const pct   = Math.min(100, Number(w.weight) || 0);
            return (
              <div key={w.evidenceTypeId} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{ev.name}</span>
                  {/* Bar */}
                  <div style={{ height: "4px", background: "#F3F4F6", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: isOver ? "#DC2626" : "#25476a", borderRadius: "2px", transition: "width 0.2s" }} />
                  </div>
                </div>
                {/* Weight input */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  <input
                    type="number" min="0" max="100"
                    value={w.weight}
                    onChange={(e) => changeWeight(w.evidenceTypeId, e.target.value)}
                    style={{
                      width: "60px", padding: "5px 8px", border: "1.5px solid #D1D5DB",
                      borderRadius: "7px", fontSize: "13px", fontWeight: "700",
                      fontFamily: "Inter,sans-serif", textAlign: "center", outline: "none",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#25476a"}
                    onBlur={(e) => e.target.style.borderColor = "#D1D5DB"}
                  />
                  <span style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: "600" }}>%</span>
                </div>
                {/* Remove */}
                <button type="button" className="cp-icon-btn danger" onClick={() => removeEvidence(w.evidenceTypeId)} title="Remove">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Total bar */}
      {weights.length > 0 && (
        <div style={{ marginBottom: "14px" }}>
          <div style={{ height: "6px", background: "#F3F4F6", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, total)}%`, background: isComplete ? "#059669" : isOver ? "#DC2626" : "#F59E0B", borderRadius: "3px", transition: "width 0.2s, background 0.2s" }} />
          </div>
          <p style={{ margin: "5px 0 0", fontSize: "11px", color: isComplete ? "#059669" : isOver ? "#DC2626" : "#C2410C", fontWeight: "600" }}>
            {isComplete ? "Total is 100% — ready to save" : isOver ? `Over by ${total - 100}% — adjust weights to reach 100%` : `${100 - total}% remaining to reach 100%`}
          </p>
        </div>
      )}

      {/* Add evidence picker */}
      {available.length > 0 && !adding && (
        <button type="button" className="cp-btn-add" style={{ fontSize: "12px", padding: "6px 12px", marginBottom: "14px" }} onClick={() => setAdding(true)}>
          + Assign Evidence Type
        </button>
      )}
      {adding && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "14px", padding: "10px 12px", background: "#F0F7FF", borderRadius: "10px", border: "1.5px solid #C7D9F8" }}>
          <select className="cp-select" style={{ flex: 1 }} value={pickId} onChange={(e) => setPickId(e.target.value)} autoFocus>
            <option value="">Pick evidence type…</option>
            {available.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button type="button" className="cp-btn-primary" style={{ padding: "7px 14px", fontSize: "12px" }} onClick={addEvidence} disabled={!pickId}>Add</button>
          <button type="button" className="cp-btn-secondary" style={{ padding: "7px 12px", fontSize: "12px" }} onClick={() => { setAdding(false); setPickId(""); }}>Cancel</button>
        </div>
      )}

      {/* Save button */}
      {isDirty && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button type="button" className="cp-btn-primary" onClick={handleSave} disabled={saving || (!isComplete && weights.length > 0)}>
            {saving ? "Saving…" : "Save Scoring"}
          </button>
          {!isComplete && weights.length > 0 && (
            <span style={{ fontSize: "11px", color: "#C2410C" }}>Weights must total 100% before saving.</span>
          )}
        </div>
      )}
    </div>
  );
}

function ScoringSubPanel({ curriculumId }) {
  const { data: types    = [], isLoading: loadingTypes }    = useAssessmentTypes(curriculumId);
  const { data: evidences = [], isLoading: loadingEvidence } = useEvidenceTypes(curriculumId);
  const { mutate: saveScoring, isPending: saving }           = useUpdateScoring(curriculumId);

  if (loadingTypes || loadingEvidence) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;

  if (types.length === 0) return (
    <div className="cp-empty">
      <div style={{ fontSize: "36px", marginBottom: "10px" }}>📋</div>
      <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No assessment types yet</p>
      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Go to <strong>Types</strong> and define your assessment types first.</p>
    </div>
  );

  if (evidences.length === 0) return (
    <div className="cp-empty">
      <div style={{ fontSize: "36px", marginBottom: "10px" }}>🔬</div>
      <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No evidence types yet</p>
      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Go to <strong>Evidence</strong> and define your evidence types first.</p>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Score Evidence</h3>
        <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
          For each assessment type, assign evidence types and set their weighted contribution (must total 100%).
        </p>
      </div>
      {types.map((t) => (
        <ScoringCard key={t.id} assessmentType={t} evidences={evidences} onSave={saveScoring} saving={saving} />
      ))}
    </div>
  );
}

/* ── AssessmentsPanel ───────────────────────────────────────────────────── */

const AF_SECTIONS = [
  { key: "types",    label: "Types",    icon: "📋" },
  { key: "evidence", label: "Evidence", icon: "🔬" },
  { key: "scoring",  label: "Scoring",  icon: "⚖️"  },
];

function AssessmentsPanel({ curriculumId }) {
  const [sub, setSub] = useState("types");

  return (
    <div className="cp-card">
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Assessment Framework</h2>
        <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
          Define assessment types, evidence methods, and scoring weights for this curriculum.
        </p>
      </div>

      {/* Sub-nav */}
      <div className="cp-arc-section-nav" style={{ marginBottom: "24px" }}>
        {AF_SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`cp-arc-section-btn${sub === s.key ? " active" : ""}`}
            onClick={() => setSub(s.key)}
          >
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {sub === "types"    && <AssessmentTypesSubPanel curriculumId={curriculumId} />}
      {sub === "evidence" && <EvidenceTypesSubPanel   curriculumId={curriculumId} />}
      {sub === "scoring"  && <ScoringSubPanel          curriculumId={curriculumId} />}
    </div>
  );
}

/* ── AgeCategoriesPanel ─────────────────────────────────────────────────── */

function parseAgeRange(str) {
  if (!str) return { min: "", max: "" };
  const rangeMatch = str.match(/^(\d+)\s*[–\-]\s*(\d+)$/);
  if (rangeMatch) return { min: rangeMatch[1], max: rangeMatch[2] };
  const singleMatch = str.match(/^(\d+)\+?$/);
  if (singleMatch) return { min: singleMatch[1], max: "" };
  return { min: "", max: "" };
}

function buildAgeRange(min, max) {
  const a = min.toString().trim(), b = max.toString().trim();
  if (a && b) return `${a}–${b}`;
  if (a)      return `${a}+`;
  return "";
}

function AgeCategoriesPanel({ curriculumId }) {
  const { data: cats = [], isLoading } = useAgeCategories(curriculumId);
  const { mutate: create, isPending: creating } = useCreateAgeCategory(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateAgeCategory(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteAgeCategory(curriculumId);

  const [mode,       setMode]       = useState("list");
  const [editTarget, setEditTarget] = useState(null);
  const [name,       setName]       = useState("");
  const [minAge,     setMinAge]     = useState("");
  const [maxAge,     setMaxAge]     = useState("");
  const [desc,       setDesc]       = useState("");
  const nameRef = useRef(null);

  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd() {
    setEditTarget(null); setName(""); setMinAge(""); setMaxAge(""); setDesc(""); setMode("add");
  }
  function openEdit(c) {
    const { min, max } = parseAgeRange(c.ageRange || "");
    setEditTarget(c); setName(c.name); setMinAge(min); setMaxAge(max); setDesc(c.description || ""); setMode("edit");
  }
  function cancel() { setMode("list"); setEditTarget(null); }

  function submit() {
    if (!name.trim()) return;
    if (minAge && maxAge && Number(maxAge) < Number(minAge)) return;
    const data = { name: name.trim(), ageRange: buildAgeRange(minAge, maxAge), description: desc.trim() };
    if (mode === "edit") {
      update({ id: editTarget.id, data }, { onSuccess: cancel });
    } else {
      create(data, { onSuccess: () => { setName(""); setMinAge(""); setMaxAge(""); setDesc(""); nameRef.current?.focus(); } });
    }
  }

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Age Categories</h3>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {cats.length === 0 ? "Define the age groups for this curriculum" : `${cats.length} age group${cats.length !== 1 ? "s" : ""} defined`}
          </p>
        </div>
        {mode === "list" && (
          <button type="button" className="cp-btn-primary" onClick={openAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Add Age Group
          </button>
        )}
      </div>

      {mode !== "list" && (
        <div className="cp-comp-form-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>{mode === "edit" ? "Edit Age Group" : "New Age Group"}</h3>
            </div>
            <button type="button" className="cp-icon-btn" onClick={cancel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="cp-field-label">Name <span className="cp-required">*</span></label>
              <input ref={nameRef} className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="e.g. Early Childhood, Primary, Secondary…"
                value={name} maxLength={100}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
              />
              <div className="cp-char-count">{name.length} / 100</div>
            </div>
            <div>
              <label className="cp-field-label">Age Range <span className="cp-optional">(optional)</span></label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10px", fontWeight: "600", color: "#9CA3AF", marginBottom: "3px" }}>FROM</div>
                  <input
                    className="cp-input"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="e.g. 3"
                    value={minAge}
                    style={{ width: "100%", boxSizing: "border-box" }}
                    onChange={(e) => setMinAge(e.target.value)}
                  />
                </div>
                <div style={{ color: "#9CA3AF", fontWeight: "700", fontSize: "16px", paddingTop: "18px", flexShrink: 0 }}>–</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10px", fontWeight: "600", color: "#9CA3AF", marginBottom: "3px" }}>TO</div>
                  <input
                    className="cp-input"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="e.g. 5"
                    value={maxAge}
                    style={{ width: "100%", boxSizing: "border-box" }}
                    onChange={(e) => setMaxAge(e.target.value)}
                  />
                </div>
                <div style={{ color: "#9CA3AF", fontSize: "11px", fontWeight: "600", paddingTop: "18px", flexShrink: 0 }}>yrs</div>
              </div>
              {minAge && maxAge && Number(maxAge) < Number(minAge) && (
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#DC2626" }}>
                  "To" age must be greater than "From" age.
                </p>
              )}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="cp-field-label">Description <span className="cp-optional">(optional)</span></label>
              <textarea className="cp-textarea" rows={2}
                placeholder="Describe the characteristics or focus of this age group…"
                value={desc} maxLength={500}
                onChange={(e) => setDesc(e.target.value)}
              />
              <div className="cp-char-count">{desc.length} / 500</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
            <button type="button" className="cp-btn-primary" onClick={submit} disabled={(creating || updating) || !name.trim()}>
              {creating || updating ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Group"}
            </button>
            <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {cats.length === 0 && mode === "list" ? (
        <div className="cp-empty">
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>👶</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No age groups yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF", maxWidth: "300px", marginInline: "auto" }}>
            Create age groups to organize the progress arc for different learner stages.
          </p>
          <button type="button" className="cp-btn-ghost" onClick={openAdd}>+ Add First Age Group</button>
        </div>
      ) : (
        <div className="cp-comp-grid">
          {cats.map((cat, idx) => {
            const color   = COMP_PALETTE[idx % COMP_PALETTE.length];
            const initial = cat.name.charAt(0).toUpperCase();
            return (
              <div key={cat.id} className="cp-comp-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
                    backgroundColor: `${color}15`, border: `2px solid ${color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "17px", fontWeight: "800", color,
                  }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", lineHeight: 1.35 }}>{cat.name}</p>
                    {cat.ageRange && (
                      <span style={{
                        display: "inline-block", marginTop: "5px", padding: "2px 8px", borderRadius: "20px",
                        fontSize: "10px", fontWeight: "700", backgroundColor: `${color}12`, color, border: `1px solid ${color}28`,
                      }}>
                        {cat.ageRange}
                      </span>
                    )}
                  </div>
                  <CardKebab onEdit={() => openEdit(cat)} onDelete={() => remove(cat.id)} disabled={deleting} />
                </div>
                <div style={{ flex: 1 }}>
                  {cat.description ? (
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.65", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {cat.description}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No description</p>
                  )}
                </div>
              </div>
            );
          })}
          {mode === "list" && (
            <button type="button" className="cp-comp-card cp-comp-card--add" onClick={openAdd}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div className="cp-add-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                </div>
                <span className="cp-add-card-label">Add Age Group</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── LevelsPanel ─────────────────────────────────────────────────────────── */

const LEVEL_PALETTE = [
  "#059669","#0891B2","#7C3AED","#D97706",
  "#DC2626","#BE185D","#25476a","#38aae1",
  "#2e7db5","#0A3880",
];

function LevelsPanel({ curriculumId }) {
  const { data: levels = [], isLoading } = useProgressLevels(curriculumId);
  const { mutate: create, isPending: creating } = useCreateProgressLevel(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateProgressLevel(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteProgressLevel(curriculumId);

  const [mode,       setMode]       = useState("list");
  const [editTarget, setEditTarget] = useState(null);
  const [name,       setName]       = useState("");
  const [desc,       setDesc]       = useState("");
  const nameRef = useRef(null);

  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()   { setEditTarget(null); setName(""); setDesc(""); setMode("add"); }
  function openEdit(l) { setEditTarget(l); setName(l.name); setDesc(l.description || ""); setMode("edit"); }
  function cancel()    { setMode("list"); setEditTarget(null); }

  function submit() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: desc.trim() };
    if (mode === "edit") {
      update({ id: editTarget.id, data }, { onSuccess: cancel });
    } else {
      create(data, { onSuccess: () => { setName(""); setDesc(""); nameRef.current?.focus(); } });
    }
  }

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Levels</h3>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {levels.length === 0 ? "Define proficiency levels for learners" : `${levels.length} level${levels.length !== 1 ? "s" : ""} defined`}
          </p>
        </div>
        {mode === "list" && (
          <button type="button" className="cp-btn-primary" onClick={openAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Add Level
          </button>
        )}
      </div>

      {mode !== "list" && (
        <div className="cp-comp-form-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>{mode === "edit" ? "Edit Level" : "New Level"}</h3>
            <button type="button" className="cp-icon-btn" onClick={cancel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label className="cp-field-label">Name <span className="cp-required">*</span></label>
              <input ref={nameRef} className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="e.g. Emerging, Developing, Proficient, Advanced…"
                value={name} maxLength={100}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
              />
              <div className="cp-char-count">{name.length} / 100</div>
            </div>
            <div>
              <label className="cp-field-label">Description <span className="cp-optional">(optional)</span></label>
              <textarea className="cp-textarea" rows={3}
                placeholder="What does this proficiency level mean? What can a learner at this level do?"
                value={desc} maxLength={500}
                onChange={(e) => setDesc(e.target.value)}
              />
              <div className="cp-char-count">{desc.length} / 500</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
            <button type="button" className="cp-btn-primary" onClick={submit} disabled={(creating || updating) || !name.trim()}>
              {creating || updating ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Level"}
            </button>
            <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {levels.length === 0 && mode === "list" ? (
        <div className="cp-empty">
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>📊</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No levels yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF", maxWidth: "300px", marginInline: "auto" }}>
            Define proficiency levels so learners and teachers have clear progression benchmarks.
          </p>
          <button type="button" className="cp-btn-ghost" onClick={openAdd}>+ Add First Level</button>
        </div>
      ) : (
        <div className="cp-comp-grid">
          {levels.map((level, idx) => {
            const color   = LEVEL_PALETTE[idx % LEVEL_PALETTE.length];
            const initial = level.name.charAt(0).toUpperCase();
            return (
              <div key={level.id} className="cp-comp-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
                    backgroundColor: `${color}15`, border: `2px solid ${color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "17px", fontWeight: "800", color,
                  }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", lineHeight: 1.35 }}>{level.name}</p>
                    <span style={{ display: "inline-block", marginTop: "5px", fontSize: "10px", color: "#9CA3AF" }}>
                      Level {level.order}
                    </span>
                  </div>
                  <CardKebab onEdit={() => openEdit(level)} onDelete={() => remove(level.id)} disabled={deleting} />
                </div>
                <div style={{ flex: 1 }}>
                  {level.description ? (
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.65", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {level.description}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No description</p>
                  )}
                </div>
              </div>
            );
          })}
          {mode === "list" && (
            <button type="button" className="cp-comp-card cp-comp-card--add" onClick={openAdd}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div className="cp-add-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                </div>
                <span className="cp-add-card-label">Add Level</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── ArcCompetenciesPanel ────────────────────────────────────────────────── */

function ArcCompetenciesPanel({ curriculumId }) {
  const { data: comps  = [], isLoading } = useCompetencies(curriculumId);
  const { data: areas  = [] }            = useLearningAreas(curriculumId);
  const areaMap = Object.fromEntries(areas.map((a) => [a.id, a]));

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Competencies</h3>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {comps.length === 0 ? "No competencies defined yet" : `${comps.length} competenc${comps.length !== 1 ? "ies" : "y"} from the Competencies tab`}
          </p>
        </div>
      </div>

      {comps.length === 0 ? (
        <div className="cp-empty">
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>🎯</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No competencies defined yet</p>
          <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#9CA3AF", maxWidth: "320px", marginInline: "auto" }}>
            Switch to the <strong>Competencies</strong> tab to define the core capabilities for this curriculum.
          </p>
        </div>
      ) : (
        <>
          <div style={{ padding: "10px 14px", background: "#F0F7FF", border: "1px solid #C7D9F8", borderRadius: "10px", fontSize: "12px", color: "#25476a", marginBottom: "18px" }}>
            These competencies are defined in the <strong>Competencies</strong> tab. Manage them there; they will appear here for reference.
          </div>
          <div className="cp-comp-grid">
            {comps.map((comp, idx) => {
              const area    = areaMap[comp.learningAreaId];
              const color   = area?.color || COMP_PALETTE[idx % COMP_PALETTE.length];
              const initial = comp.name.charAt(0).toUpperCase();
              return (
                <div key={comp.id} className="cp-arc-comp-card">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "11px", flexShrink: 0,
                      backgroundColor: `${color}15`, border: `2px solid ${color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "16px", fontWeight: "800", color,
                    }}>
                      {initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827", lineHeight: 1.35 }}>{comp.name}</p>
                      {area ? (
                        <span style={{ display: "inline-block", marginTop: "4px", padding: "2px 7px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", backgroundColor: `${color}12`, color, border: `1px solid ${color}28` }}>
                          {area.name}
                        </span>
                      ) : (
                        <span style={{ display: "inline-block", marginTop: "4px", fontSize: "10px", color: "#D1D5DB" }}>No area</span>
                      )}
                    </div>
                  </div>
                  {comp.description && (
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.65", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {comp.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── ProgressArcPanel ────────────────────────────────────────────────────── */

const ARC_SECTIONS = [
  { key: "age-categories", label: "Age Categories", icon: "👶" },
  { key: "levels",         label: "Levels",         icon: "📊" },
  { key: "competencies",   label: "Competencies",   icon: "🎯" },
];

function ProgressArcPanel({ curriculumId, arcSub = "age-categories", onArcSubChange }) {
  const setArcSub = onArcSubChange ?? (() => {});

  return (
    <div className="cp-card">
      <div className="cp-arc-section-header">
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Progress Arc</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            Define age groups, proficiency levels, and view competencies in context.
          </p>
        </div>
        <div className="cp-arc-section-nav">
          {ARC_SECTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`cp-arc-section-btn${arcSub === key ? " active" : ""}`}
              onClick={() => setArcSub(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {arcSub === "age-categories" && <AgeCategoriesPanel  curriculumId={curriculumId} />}
      {arcSub === "levels"         && <LevelsPanel         curriculumId={curriculumId} />}
      {arcSub === "competencies"   && <ArcCompetenciesPanel curriculumId={curriculumId} />}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */

export default function CompetenciesPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { data: curriculum } = useCurriculumQuery(id);

  const [activeNav, setActiveNav] = useState("competencies");
  const [arcSub,    setArcSub]    = useState("age-categories");

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <button type="button" onClick={() => navigate("/curriculum")} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "12px", fontFamily: "Inter,sans-serif", cursor: "pointer", padding: 0 }}>
              Curriculum
            </button>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#9CA3AF", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{curriculum?.name}</span>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>Competencies</span>
          </div>
          <h1 style={{ margin: "0 0 3px", fontSize: "22px", fontWeight: "800", color: "#0F2645" }}>Competencies</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Define competencies, learning areas, the progress arc, and assessments for this curriculum.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button type="button" className="cp-btn-secondary" onClick={() => navigate(`/curriculum/${id}/versions`)}>
            ← Version Control
          </button>
          <button type="button" className="cp-btn-primary" style={{ background: "#0F2645" }} onClick={() => navigate("/curriculum")}>
            Done
          </button>
        </div>
      </div>

      <StepIndicator current={5} />

      {/* ── Panel navigation ────────────────────────────────────────── */}
      <div className="cp-nav">
        {/* Standard tabs */}
        {[
          { key: "competencies", label: "Competencies" },
          { key: "areas",        label: "Learning Areas" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`cp-nav-btn${activeNav === key ? " active" : ""}`}
            onClick={() => setActiveNav(key)}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          className={`cp-nav-btn${activeNav === "arc" ? " active" : ""}`}
          onClick={() => setActiveNav("arc")}
        >
          Progress Arc
        </button>

        <button
          type="button"
          className={`cp-nav-btn${activeNav === "assessments" ? " active" : ""}`}
          onClick={() => setActiveNav("assessments")}
        >
          Assessments
        </button>
      </div>

      {/* ── Panels ──────────────────────────────────────────────────── */}
      {activeNav === "competencies" && <CompetenciesPanel  curriculumId={id} />}
      {activeNav === "areas"        && <LearningAreasPanel curriculumId={id} />}
      {activeNav === "arc"          && <ProgressArcPanel   curriculumId={id} arcSub={arcSub} onArcSubChange={setArcSub} />}
      {activeNav === "assessments"  && <AssessmentsPanel curriculumId={id} />}
    </div>
  );
}
