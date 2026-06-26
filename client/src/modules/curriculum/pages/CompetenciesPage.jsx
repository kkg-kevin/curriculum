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
  useUpdateGlobalScoring,

  useEvidenceTypes,
  useCreateEvidenceType,
  useUpdateEvidenceType,
  useDeleteEvidenceType,
  usePerformanceBands,
  useCreatePerformanceBand,
  useUpdatePerformanceBand,
  useDeletePerformanceBand,
  useReorderPerformanceBands,
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

  /* Competency gate */
  .cp-gate-banner {
    border-radius:10px; padding:12px 16px;
    display:flex; align-items:center; gap:10px;
    animation:cp-fadein 0.15s ease;
  }
  .cp-gate-banner--pass { background:#F0FDF4; border:1.5px solid #86EFAC; }
  .cp-gate-banner--fail { background:#FEF2F2; border:1.5px solid #FCA5A5; }
  .cp-gate-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .cp-threshold-met    { background:#F0FDF4; border:1px solid #86EFAC; color:#15803D; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; }
  .cp-threshold-notmet { background:#FEF2F2; border:1px solid #FCA5A5; color:#DC2626; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; }
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
  const [threshold,  setThreshold]  = useState(60);
  const nameRef = useRef(null);

  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd() {
    setEditTarget(null); setName(""); setDesc(""); setAreaId(""); setThreshold(60); setMode("add");
  }
  function openEdit(comp) {
    setEditTarget(comp);
    setName(comp.name);
    setDesc(comp.description || "");
    setAreaId(comp.learningAreaId || "");
    setThreshold(comp.minimumThreshold ?? 60);
    setMode("edit");
  }
  function cancelForm() { setMode("list"); setEditTarget(null); }

  function submit() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: desc.trim(), learningAreaId: areaId || null, minimumThreshold: Number(threshold) || 60 };
    if (mode === "edit") {
      update({ id: editTarget.id, data }, { onSuccess: cancelForm });
    } else {
      create(data, {
        onSuccess: () => { setName(""); setDesc(""); setAreaId(""); setThreshold(60); nameRef.current?.focus(); },
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

            {/* Minimum threshold */}
            <div>
              <label className="cp-field-label">
                Minimum Threshold % <span className="cp-required">*</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
                <input
                  type="range"
                  min={0} max={100} step={5}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "#25476a" }}
                />
                <span style={{
                  minWidth: "42px", padding: "4px 10px", borderRadius: "8px", textAlign: "center",
                  background: threshold >= 75 ? "#F0FDF4" : threshold >= 60 ? "#EFF6FF" : "#FFF7ED",
                  border: `1.5px solid ${threshold >= 75 ? "#BBF7D0" : threshold >= 60 ? "#BFDBFE" : "#FED7AA"}`,
                  fontSize: "13px", fontWeight: "700",
                  color: threshold >= 75 ? "#15803D" : threshold >= 60 ? "#1D4ED8" : "#C2410C",
                }}>
                  {threshold}%
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                Learner must score at least {threshold}% on this competency to be considered competent.
              </p>
            </div>
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
                      display: "-webkit-box", WebkitLineClamp: 3,
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

                {/* Threshold badge */}
                <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ color: "#9CA3AF", flexShrink: 0 }}>
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Min. threshold:</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "700",
                    background: (comp.minimumThreshold ?? 60) >= 75 ? "#F0FDF4" : (comp.minimumThreshold ?? 60) >= 60 ? "#EFF6FF" : "#FFF7ED",
                    border: `1px solid ${(comp.minimumThreshold ?? 60) >= 75 ? "#BBF7D0" : (comp.minimumThreshold ?? 60) >= 60 ? "#BFDBFE" : "#FED7AA"}`,
                    color: (comp.minimumThreshold ?? 60) >= 75 ? "#15803D" : (comp.minimumThreshold ?? 60) >= 60 ? "#1D4ED8" : "#C2410C",
                  }}>
                    {comp.minimumThreshold ?? 60}%
                  </span>
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

const BEHAVIOR_OPTIONS = [
  { value: "diagnostic", label: "Diagnostic", desc: "Evaluates prior knowledge and placement — no pass/fail" },
  { value: "formative",  label: "Formative",  desc: "Tracks continuous progress — flexible evaluation" },
  { value: "summative",  label: "Summative",  desc: "Determines final competency — strict requirements" },
];

const BEHAVIOR_COLORS = { diagnostic: "#0891B2", formative: "#059669", summative: "#7C3AED" };

function AssessmentTypesSubPanel({ curriculumId }) {
  const { data: types = [], isLoading } = useAssessmentTypes(curriculumId);
  const { mutate: create, isPending: creating } = useCreateAssessmentType(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateAssessmentType(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteAssessmentType(curriculumId);

  const [mode, setMode]         = useState("list");
  const [editTarget, setEdit]   = useState(null);
  const [name, setName]         = useState("");
  const [desc, setDesc]         = useState("");
  const [behavior, setBehavior] = useState("formative");
  const nameRef = useRef(null);
  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()  { setEdit(null); setName(""); setDesc(""); setBehavior("formative"); setMode("add"); }
  function openEdit(t){ setEdit(t); setName(t.name); setDesc(t.description || ""); setBehavior(t.behaviorType || "formative"); setMode("edit"); }
  function cancel()   { setMode("list"); setEdit(null); }
  function submit() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: desc.trim(), behaviorType: behavior };
    if (mode === "edit") update({ id: editTarget.id, data }, { onSuccess: cancel });
    else create(data, { onSuccess: () => { setName(""); setDesc(""); setBehavior("formative"); nameRef.current?.focus(); } });
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
          <label className="cp-field-label">Behavior Mode <span className="cp-required">*</span></label>
          <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>Controls how scoring rules and outcomes are applied for this type.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {BEHAVIOR_OPTIONS.map((opt) => {
              const active = behavior === opt.value;
              const col    = BEHAVIOR_COLORS[opt.value];
              return (
                <button
                  key={opt.value} type="button"
                  onClick={() => setBehavior(opt.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "9px 12px", borderRadius: "8px", cursor: "pointer", textAlign: "left",
                    border: `2px solid ${active ? col : "#E5E7EB"}`,
                    background: active ? `${col}10` : "#F9FAFB",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: `2px solid ${active ? col : "#D1D5DB"}`, background: active ? col : "transparent", flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: active ? col : "#374151" }}>{opt.label}</span>
                    <span style={{ fontSize: "11px", color: "#9CA3AF", marginLeft: "8px" }}>{opt.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
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
                <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
                  {t.behaviorType && (
                    <span style={{ fontSize: "10px", fontWeight: "700", color: BEHAVIOR_COLORS[t.behaviorType] || "#6B7280", background: `${BEHAVIOR_COLORS[t.behaviorType] || "#6B7280"}15`, padding: "2px 7px", borderRadius: "20px", textTransform: "capitalize" }}>
                      {t.behaviorType}
                    </span>
                  )}
                  {(t.evidenceWeights || []).length > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#059669", background: "#05966915", padding: "2px 7px", borderRadius: "20px" }}>
                      {(t.evidenceWeights || []).length} evidence scored
                    </span>
                  )}
                </div>
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

  const [mode,        setMode]       = useState("list");
  const [editTarget,  setEdit]       = useState(null);
  const [name,        setName]       = useState("");
  const [desc,        setDesc]       = useState("");
  const [defContrib,  setDefContrib] = useState("0");
  const [minReq,      setMinReq]     = useState("0");
  const nameRef = useRef(null);
  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()  { setEdit(null); setName(""); setDesc(""); setDefContrib("0"); setMinReq("0"); setMode("add"); }
  function openEdit(e){ setEdit(e); setName(e.name); setDesc(e.description || ""); setDefContrib(String(e.defaultContribution ?? 0)); setMinReq(String(e.minRequirement ?? 0)); setMode("edit"); }
  function cancel()   { setMode("list"); setEdit(null); }
  function submit() {
    if (!name.trim()) return;
    const data = {
      name: name.trim(), description: desc.trim(),
      defaultContribution: Math.min(100, Math.max(0, Number(defContrib) || 0)),
      minRequirement:      Math.min(100, Math.max(0, Number(minReq) || 0)),
    };
    if (mode === "edit") update({ id: editTarget.id, data }, { onSuccess: cancel });
    else create(data, { onSuccess: () => { setName(""); setDesc(""); setDefContrib("0"); setMinReq("0"); nameRef.current?.focus(); } });
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label className="cp-field-label">Default Contribution %</label>
            <p style={{ margin: "2px 0 6px", fontSize: "11px", color: "#9CA3AF" }}>Auto-filled when attached to an assessment type.</p>
            <div style={{ position: "relative" }}>
              <input className="cp-input" type="number" min="0" max="100" style={{ width: "100%", boxSizing: "border-box", paddingRight: "30px" }}
                value={defContrib}
                onChange={(e) => setDefContrib(e.target.value)}
              />
              <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "#9CA3AF", pointerEvents: "none" }}>%</span>
            </div>
          </div>
          <div>
            <label className="cp-field-label">Minimum Requirement %</label>
            <p style={{ margin: "2px 0 6px", fontSize: "11px", color: "#9CA3AF" }}>Score below this flags the learner as below requirement.</p>
            <div style={{ position: "relative" }}>
              <input className="cp-input" type="number" min="0" max="100" style={{ width: "100%", boxSizing: "border-box", paddingRight: "30px" }}
                value={minReq}
                onChange={(e) => setMinReq(e.target.value)}
              />
              <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "#9CA3AF", pointerEvents: "none" }}>%</span>
            </div>
          </div>
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
                <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
                  {e.defaultContribution > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#2563EB", background: "#2563EB15", padding: "2px 7px", borderRadius: "20px" }}>
                      {e.defaultContribution}% default
                    </span>
                  )}
                  {e.minRequirement > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#D97706", background: "#D9770615", padding: "2px 7px", borderRadius: "20px" }}>
                      {e.minRequirement}% min
                    </span>
                  )}
                </div>
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

/* ── Scoring utilities ──────────────────────────────────────────────────── */

function calcScore(evidenceScores, evidenceConfig, evidenceTypes, bands, types = [], typeWeights = {}) {
  const sortedBands = [...bands].sort((a, b) => a.minScore - b.minScore);

  // Tier-1: compute a score per assessment type (evidence weights sum to 100% internally)
  const typeScores = {};
  const breakdown  = [];
  const belowReq   = [];

  for (const at of types) {
    const typeEvidence = evidenceConfig.filter((c) => c.assignedTo === at.id);
    if (!typeEvidence.length) { typeScores[at.id] = 0; continue; }
    let typeTotal = 0;
    for (const cfg of typeEvidence) {
      const et       = evidenceTypes.find((e) => e.id === cfg.evidenceTypeId);
      const score    = Math.min(100, Math.max(0, Number(evidenceScores[cfg.evidenceTypeId]) || 0));
      const weighted = Math.round((score * cfg.contribution) / 100 * 10) / 10;
      const minReq   = cfg.minRequirement != null ? cfg.minRequirement : (et?.minRequirement ?? 0);
      typeTotal += weighted;
      breakdown.push({ id: cfg.evidenceTypeId, name: et?.name || "Unknown", score, contribution: cfg.contribution, weighted, minRequirement: minReq, belowMin: score < minReq, typeName: at.name });
      if (score < minReq) belowReq.push(breakdown[breakdown.length - 1]);
    }
    typeScores[at.id] = Math.round(typeTotal * 10) / 10;
  }

  // Tier-2: combine type scores using type weights
  const twTotal = Object.values(typeWeights).reduce((s, w) => s + (w || 0), 0);
  let finalScore = 0;
  if (twTotal > 0) {
    for (const at of types) finalScore += (typeScores[at.id] || 0) * ((typeWeights[at.id] || 0) / 100);
  } else {
    const withEv = types.filter((at) => evidenceConfig.some((c) => c.assignedTo === at.id));
    finalScore = withEv.length ? withEv.reduce((s, at) => s + (typeScores[at.id] || 0), 0) / withEv.length : 0;
  }
  finalScore = Math.round(finalScore * 10) / 10;

  const band = sortedBands.find((b) => finalScore >= b.minScore && finalScore <= b.maxScore) || null;
  return { finalScore, typeScores, breakdown, belowReq, band };
}

const BAND_SCORE_COLORS = ["#9CA3AF", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

/* ── ScoreEvidenceSubPanel ──────────────────────────────────────────────── */

function ScoreEvidenceSubPanel({ curriculumId }) {
  const { data: types     = [], isLoading: typesLoading } = useAssessmentTypes(curriculumId);
  const { data: evidences = [], isLoading: evLoading }    = useEvidenceTypes(curriculumId);
  const { data: bands     = [], isLoading: bandsLoading } = usePerformanceBands(curriculumId);
  const { mutate: saveGlobal, isPending: saving }         = useUpdateGlobalScoring(curriculumId);

  // evConfig: { [etId]: { assignedTo: atId|null, contribution, minRequirement } }
  const [evConfig,      setEvConfig]      = useState({});
  const [typeWeights,   setTypeWeights]   = useState({});
  const [scores,        setScores]        = useState({});
  const [isDirty,       setIsDirty]       = useState(false);
  const [activeTypeIdx, setActiveTypeIdx] = useState(0);

  // Initialize from each assessment type's saved evidenceWeights
  useEffect(() => {
    if (!types.length || !evidences.length) return;
    const cfg = {};
    evidences.forEach((et) => {
      cfg[et.id] = { assignedTo: null, contribution: et.defaultContribution ?? 0, minRequirement: null };
    });
    types.forEach((at) => {
      (at.evidenceWeights || []).forEach((ew) => {
        if (cfg[ew.evidenceTypeId]) {
          cfg[ew.evidenceTypeId] = {
            assignedTo:     at.id,
            contribution:   ew.contribution,
            minRequirement: ew.minRequirement,
          };
        }
      });
    });
    setEvConfig(cfg);
    const tw = {};
    types.forEach((at) => { tw[at.id] = at.typeWeight ?? 0; });
    setTypeWeights(tw);
    setScores({});
    setIsDirty(false);
    setExpandedMappings(new Set());
  }, [types, evidences]);

  function assignTo(etId, atId) {
    const et = evidences.find((e) => e.id === etId);
    setEvConfig((prev) => {
      const cur = prev[etId];
      if (cur.assignedTo === atId) {
        return { ...prev, [etId]: { ...cur, assignedTo: null, contribution: 0 } };
      }
      return { ...prev, [etId]: { ...cur, assignedTo: atId, contribution: cur.contribution || (et?.defaultContribution ?? 0) } };
    });
    setIsDirty(true);
  }

  function setContrib(etId, val) {
    setEvConfig((prev) => ({ ...prev, [etId]: { ...prev[etId], contribution: Math.min(100, Math.max(0, Number(val) || 0)) } }));
    setIsDirty(true);
  }

  function setMinReqOverride(etId, val) {
    setEvConfig((prev) => ({ ...prev, [etId]: { ...prev[etId], minRequirement: val === "" ? null : Math.min(100, Math.max(0, Number(val) || 0)) } }));
    setIsDirty(true);
  }

  const assignedEntries = Object.entries(evConfig).filter(([, v]) => v.assignedTo !== null);

  // Tier-1: per-type evidence totals (each must hit 100% if it has any evidence)
  const typeTotals = Object.fromEntries(
    types.map((at) => {
      const total = Object.entries(evConfig)
        .filter(([, v]) => v.assignedTo === at.id)
        .reduce((s, [, v]) => s + (v.contribution || 0), 0);
      return [at.id, Math.round(total)];
    })
  );
  const evOk = (atId) => {
    const count = Object.values(evConfig).filter((v) => v.assignedTo === atId).length;
    return count === 0 || typeTotals[atId] === 100;
  };

  // Tier-2: type weights must sum to 100%
  const typeWeightTotal   = Object.values(typeWeights).reduce((s, w) => s + (w || 0), 0);
  const typeWeightRounded = Math.round(typeWeightTotal);
  const twColor           = typeWeightRounded < 100 ? "#D97706" : typeWeightRounded > 100 ? "#DC2626" : "#059669";
  const twBg              = typeWeightRounded < 100 ? "#D9770610" : typeWeightRounded > 100 ? "#DC262610" : "#05966910";

  const allTypesOk  = types.every((at) => evOk(at.id)) && typeWeightRounded === 100;
  const activeAt    = types[Math.min(activeTypeIdx, types.length - 1)];
  const activeTotal = activeAt ? (typeTotals[activeAt.id] ?? 0) : 0;
  const evColor     = activeTotal < 100 ? "#D97706" : activeTotal > 100 ? "#DC2626" : "#059669";
  const evBg        = activeTotal < 100 ? "#D9770610" : activeTotal > 100 ? "#DC262610" : "#05966910";

  function handleSave() {
    if (!allTypesOk) return;
    const assessmentTypes = types.map((at) => ({
      id:         at.id,
      typeWeight: typeWeights[at.id] ?? 0,
      evidenceWeights: Object.entries(evConfig)
        .filter(([, v]) => v.assignedTo === at.id)
        .map(([etId, v]) => ({
          evidenceTypeId: etId,
          contribution:   v.contribution,
          minRequirement: v.minRequirement,
        })),
    }));
    saveGlobal({ assessmentTypes }, { onSuccess: () => setIsDirty(false) });
  }

  // Two-tier scoring: compute per-type scores first, then combine with typeWeights
  const unifiedConfig = assignedEntries.map(([etId, v]) => ({
    evidenceTypeId: etId,
    contribution:   v.contribution,
    minRequirement: v.minRequirement,
    behaviorType:   types.find((t) => t.id === v.assignedTo)?.behaviorType || "formative",
    assignedTo:     v.assignedTo,
  }));

  const result = calcScore(scores, unifiedConfig, evidences, bands, types, typeWeights);
  const bandIdx   = bands.findIndex((b) => b.id === result.band?.id);
  const bandColor = bandIdx >= 0 ? BAND_SCORE_COLORS[Math.min(bandIdx, BAND_SCORE_COLORS.length - 1)] : "#9CA3AF";

  const hasAnyScores       = Object.values(scores).some((s) => s !== "");
  const hasSummativeBelow  = unifiedConfig.some((cfg) => {
    const sc   = Number(scores[cfg.evidenceTypeId]) || 0;
    const minR = cfg.minRequirement != null ? cfg.minRequirement : (evidences.find((e) => e.id === cfg.evidenceTypeId)?.minRequirement ?? 0);
    return cfg.behaviorType === "summative" && scores[cfg.evidenceTypeId] !== undefined && scores[cfg.evidenceTypeId] !== "" && sc < minR;
  });
  let outcome = null;
  if (assignedEntries.length > 0 && hasAnyScores) {
    const allDiag = unifiedConfig.every((c) => c.behaviorType === "diagnostic");
    if (allDiag) {
      outcome = { type: "placement",       color: "#0891B2", bg: "#0891B210", label: result.band ? `Placement: ${result.band.name} level` : "No band matched" };
    } else if (hasSummativeBelow) {
      outcome = { type: "cannot_progress", color: "#DC2626", bg: "#DC262610", label: "Cannot progress — summative evidence below minimum" };
    } else if (result.belowReq.length > 0) {
      outcome = { type: "below_req",       color: "#D97706", bg: "#D9770610", label: `${result.belowReq.length} evidence type${result.belowReq.length > 1 ? "s" : ""} below minimum requirement` };
    } else {
      outcome = { type: "passed",          color: "#059669", bg: "#05966910", label: "All requirements met" };
    }
  }

  if (typesLoading || evLoading || bandsLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;
  if (types.length === 0) return (
    <div className="cp-empty">
      <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No Assessment Types Yet</p>
      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Create assessment types first, then configure scoring here.</p>
    </div>
  );
  if (evidences.length === 0) return (
    <div className="cp-empty">
      <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No Evidence Types Yet</p>
      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Create evidence types first, then assign them here.</p>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", height: "calc(100vh - 270px)", minHeight: "480px", overflow: "hidden" }}>

      {/* ── Left: Global scoring configuration ── */}
      {(() => {
        const safeIdx   = Math.min(activeTypeIdx, types.length - 1);
        const at        = types[safeIdx];
        const col       = BEHAVIOR_COLORS[at?.behaviorType] || "#6B7280";
        const typeTotal = at ? (typeTotals[at.id] ?? 0) : 0;
        const atOk      = at ? evOk(at.id) : true;
        const atTw      = at ? (typeWeights[at.id] ?? 0) : 0;
        return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", borderRight: "1.5px solid #E5E7EB" }}>

        {/* ── Type carousel header ── */}
        <div style={{ paddingRight: "16px", paddingBottom: "10px", flexShrink: 0 }}>
          <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assessment Type</p>

          {/* Arrow nav row */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button type="button" onClick={() => setActiveTypeIdx((i) => Math.max(0, i - 1))}
              disabled={safeIdx === 0}
              style={{
                width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0, cursor: safeIdx === 0 ? "default" : "pointer",
                border: "1.5px solid #E5E7EB", background: safeIdx === 0 ? "#F9FAFB" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: safeIdx === 0 ? 0.35 : 1, transition: "all 0.15s",
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polyline points="15 18 9 12 15 6" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Active type pill */}
            <div style={{ flex: 1, padding: "8px 12px", borderRadius: "10px", background: `${col}12`, border: `1.5px solid ${col}40`, display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: col, lineHeight: 1.2 }}>{at?.name || "—"}</p>
                <p style={{ margin: "2px 0 0", fontSize: "10px", color: col, opacity: 0.7, textTransform: "capitalize" }}>{at?.behaviorType}</p>
              </div>

              {/* Type weight input (Tier-2) */}
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <p style={{ margin: "0 0 3px", fontSize: "9px", fontWeight: "700", color: col, textTransform: "uppercase", letterSpacing: "0.05em" }}>Type Weight</p>
                <div style={{ position: "relative", width: "56px" }}>
                  <input className="cp-input" type="number" min="0" max="100"
                    style={{ width: "100%", boxSizing: "border-box", padding: "4px 18px 4px 8px", fontSize: "13px", fontWeight: "800", textAlign: "center", borderColor: `${col}60` }}
                    value={atTw}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                      setTypeWeights((prev) => ({ ...prev, [at.id]: val }));
                      setIsDirty(true);
                    }}
                  />
                  <span style={{ position: "absolute", right: "5px", top: "50%", transform: "translateY(-50%)", fontSize: "10px", color: "#9CA3AF", pointerEvents: "none" }}>%</span>
                </div>
              </div>

              {/* Evidence total (Tier-1) */}
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <p style={{ margin: "0 0 3px", fontSize: "9px", fontWeight: "700", color: col, textTransform: "uppercase", letterSpacing: "0.05em" }}>Evidence</p>
                <span style={{ fontSize: "16px", fontWeight: "900", color: atOk && typeTotal > 0 ? "#059669" : typeTotal > 0 ? "#D97706" : "#9CA3AF" }}>{typeTotal}%</span>
                {atOk && typeTotal > 0 && <p style={{ margin: "1px 0 0", fontSize: "9px", color: "#059669", fontWeight: "700" }}>✓</p>}
                {!atOk && typeTotal > 0 && <p style={{ margin: "1px 0 0", fontSize: "9px", color: "#D97706", fontWeight: "600" }}>{100 - typeTotal > 0 ? `need ${100 - typeTotal}` : `${typeTotal - 100} over`}</p>}
              </div>
            </div>

            <button type="button" onClick={() => setActiveTypeIdx((i) => Math.min(types.length - 1, i + 1))}
              disabled={safeIdx === types.length - 1}
              style={{
                width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0, cursor: safeIdx === types.length - 1 ? "default" : "pointer",
                border: "1.5px solid #E5E7EB", background: safeIdx === types.length - 1 ? "#F9FAFB" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: safeIdx === types.length - 1 ? 0.35 : 1, transition: "all 0.15s",
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polyline points="9 18 15 12 9 6" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Step dots */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px" }}>
            {types.map((t, i) => {
              const tCol   = BEHAVIOR_COLORS[t.behaviorType] || "#6B7280";
              const tTotal = Object.entries(evConfig).filter(([, v]) => v.assignedTo === t.id).reduce((s, [, v]) => s + (v.contribution || 0), 0);
              const active = i === safeIdx;
              return (
                <button key={t.id} type="button" onClick={() => setActiveTypeIdx(i)}
                  title={`${t.name} — ${Math.round(tTotal)}%`}
                  style={{
                    flex: active ? 2 : 1, height: "5px", borderRadius: "3px", border: "none", cursor: "pointer",
                    background: active ? tCol : `${tCol}40`,
                    transition: "all 0.2s",
                    padding: 0,
                  }}
                />
              );
            })}
          </div>

          {/* Per-type mini summary row */}
          <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
            {types.map((t, i) => {
              const tCol   = BEHAVIOR_COLORS[t.behaviorType] || "#6B7280";
              const tTotal = typeTotals[t.id] ?? 0;
              const tCount = Object.values(evConfig).filter((v) => v.assignedTo === t.id).length;
              const active = i === safeIdx;
              const tEvOk  = evOk(t.id);
              const tTw    = typeWeights[t.id] ?? 0;
              return (
                <button key={t.id} type="button" onClick={() => setActiveTypeIdx(i)}
                  style={{
                    flex: 1, padding: "5px 8px", borderRadius: "8px",
                    border: `1.5px solid ${active ? tCol + "60" : "#E5E7EB"}`,
                    background: active ? `${tCol}08` : "#F9FAFB", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: active ? tCol : "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</p>
                  <p style={{ margin: "1px 0 0", fontSize: "11px", fontWeight: "800", color: tTw > 0 ? tCol : "#9CA3AF" }}>{tTw}% <span style={{ fontWeight: "400", fontSize: "9px", color: "#9CA3AF" }}>type wt.</span></p>
                  <p style={{ margin: "1px 0 0", fontSize: "10px", fontWeight: "600", color: tEvOk && tCount > 0 ? "#059669" : tCount > 0 ? "#D97706" : "#9CA3AF" }}>
                    {tTotal}% ev.{tCount > 0 && tEvOk && " ✓"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable evidence rows for the active type */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "16px", display: "flex", flexDirection: "column", gap: "7px", paddingBottom: "4px" }}>
          {at && evidences.map((et) => {
            const cfg         = evConfig[et.id] || { assignedTo: null, contribution: 0 };
            const isHere      = cfg.assignedTo === at.id;
            const isElsewhere = cfg.assignedTo !== null && cfg.assignedTo !== at.id;
            const otherType   = isElsewhere ? types.find((t) => t.id === cfg.assignedTo) : null;

            return (
              <div key={et.id} style={{
                borderRadius: "8px", padding: "9px 11px",
                border: `1.5px solid ${isHere ? col + "50" : "#E5E7EB"}`,
                background: isHere ? `${col}08` : "#fff",
                opacity: isElsewhere ? 0.55 : 1, transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button type="button" onClick={() => assignTo(et.id, at.id)} style={{
                    width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0, cursor: "pointer",
                    border: `2px solid ${isHere ? col : "#D1D5DB"}`, background: isHere ? col : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isHere && <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: isHere ? "#111827" : "#9CA3AF", flex: 1 }}>{et.name}</span>
                  {isElsewhere && (
                    <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", background: "#F3F4F6", color: "#6B7280", fontWeight: "600", whiteSpace: "nowrap" }}>
                      → {otherType?.name || "Other"}
                    </span>
                  )}
                </div>

                {isHere && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginTop: "9px" }}>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280", display: "block", marginBottom: "3px" }}>Contribution %</label>
                      <div style={{ position: "relative" }}>
                        <input className="cp-input" type="number" min="0" max="100"
                          style={{ width: "100%", boxSizing: "border-box", padding: "5px 22px 5px 9px", fontSize: "12px" }}
                          value={cfg.contribution}
                          onChange={(e) => setContrib(et.id, e.target.value)}
                        />
                        <span style={{ position: "absolute", right: "7px", top: "50%", transform: "translateY(-50%)", fontSize: "10px", color: "#9CA3AF", pointerEvents: "none" }}>%</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280", display: "block", marginBottom: "3px" }}>Min Req %</label>
                      <div style={{ position: "relative" }}>
                        <input className="cp-input" type="number" min="0" max="100"
                          placeholder={`${et.minRequirement ?? 0}%`}
                          style={{ width: "100%", boxSizing: "border-box", padding: "5px 22px 5px 9px", fontSize: "12px" }}
                          value={cfg.minRequirement == null ? "" : cfg.minRequirement}
                          onChange={(e) => setMinReqOverride(et.id, e.target.value)}
                        />
                        <span style={{ position: "absolute", right: "7px", top: "50%", transform: "translateY(-50%)", fontSize: "10px", color: "#9CA3AF", pointerEvents: "none" }}>%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>{/* end scrollable evidence rows */}

        {/* Sticky bottom: two-tier tracker + save */}
        <div style={{ flexShrink: 0, paddingRight: "16px", paddingTop: "10px", borderTop: "1.5px solid #E5E7EB", background: "#fff", display: "flex", flexDirection: "column", gap: "7px" }}>
          {/* Tier-1: current type's evidence total */}
          <div style={{ padding: "8px 12px", borderRadius: "8px", background: evBg, border: `1.5px solid ${evColor}30` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#374151" }}>Evidence — {activeAt?.name}</span>
              <span style={{ fontSize: "13px", fontWeight: "800", color: evColor }}>{activeTotal}% / 100%</span>
            </div>
            <div style={{ height: "5px", borderRadius: "3px", background: "#E5E7EB", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: "3px", width: `${Math.min(100, activeTotal)}%`, background: evColor, transition: "width 0.2s, background 0.2s" }} />
            </div>
          </div>

          {/* Tier-2: type weights total */}
          <div style={{ padding: "8px 12px", borderRadius: "8px", background: twBg, border: `1.5px solid ${twColor}30` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#374151" }}>Type Weights (all types)</span>
              <span style={{ fontSize: "13px", fontWeight: "800", color: twColor }}>{typeWeightRounded}% / 100%</span>
            </div>
            <div style={{ height: "5px", borderRadius: "3px", background: "#E5E7EB", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: "3px", width: `${Math.min(100, typeWeightRounded)}%`, background: twColor, transition: "width 0.2s, background 0.2s" }} />
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "10px", color: twColor, fontWeight: "600" }}>
              {typeWeightRounded < 100 ? `${100 - typeWeightRounded}% unallocated` : typeWeightRounded > 100 ? `${typeWeightRounded - 100}% over` : "All type weights balanced ✓"}
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button type="button" className="cp-btn-primary" onClick={handleSave}
              disabled={!allTypesOk || !isDirty || saving || assignedEntries.length === 0}
            >
              {saving ? "Saving…" : "Save All"}
            </button>
            {!allTypesOk && (
              <span style={{ fontSize: "11px", color: "#D97706", fontWeight: "600" }}>
                {typeWeightRounded !== 100 ? `Type weights: ${typeWeightRounded}%` : types.filter((at) => !evOk(at.id)).map((at) => at.name).join(", ") + " evidence ≠ 100%"}
              </span>
            )}
          </div>
        </div>
      </div>
        );
      })()}

      {/* ── Right: Score Calculator ── */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingLeft: "20px", overflow: "hidden" }}>
        {/* Sticky column header */}
        <div style={{ flexShrink: 0, paddingBottom: "10px" }}>
          <h3 style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: "800", color: "#0F2645" }}>Score Calculator</h3>
          <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Enter learner scores to preview the result and performance band.</p>
        </div>

        {/* Scrollable calculator content */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px", paddingBottom: "4px" }}>
        {assignedEntries.length === 0 ? (
          <div style={{ padding: "24px", borderRadius: "10px", background: "#F9FAFB", border: "1.5px dashed #E5E7EB", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Assign evidence types to assessment types on the left to use the calculator.</p>
          </div>
        ) : (
          <>
            {/* Score inputs grouped by assessment type */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {types.map((at) => {
                const col     = BEHAVIOR_COLORS[at.behaviorType] || "#6B7280";
                const typeEvs = Object.entries(evConfig).filter(([, v]) => v.assignedTo === at.id);
                if (typeEvs.length === 0) return null;
                const tw        = typeWeights[at.id] ?? 0;
                const typeScore = result.typeScores?.[at.id] ?? 0;
                return (
                  <div key={at.id} style={{ borderRadius: "8px", border: `1.5px solid ${col}25`, overflow: "hidden" }}>
                    <div style={{ padding: "6px 10px", background: `${col}10`, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${col}20` }}>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: col }}>{at.name}</span>
                      <span style={{ fontSize: "11px", color: col, opacity: 0.8 }}>
                        type wt. {tw}% · score: <strong>{hasAnyScores ? typeScore : "—"}</strong>
                      </span>
                    </div>
                    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {typeEvs.map(([etId, v]) => {
                        const et       = evidences.find((e) => e.id === etId);
                        const minR     = v.minRequirement != null ? v.minRequirement : (et?.minRequirement ?? 0);
                        const scoreVal = Number(scores[etId]) || 0;
                        const below    = scoreVal < minR && scores[etId] !== undefined && scores[etId] !== "";
                        return (
                          <div key={etId}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                              <span style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>{et?.name || etId}</span>
                              <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{v.contribution}% · min {minR}%</span>
                            </div>
                            <div style={{ position: "relative" }}>
                              <input className="cp-input" type="number" min="0" max="100" placeholder="0–100"
                                style={{ width: "100%", boxSizing: "border-box", padding: "6px 40px 6px 10px", fontSize: "13px", borderColor: below ? "#DC262650" : undefined }}
                                value={scores[etId] || ""}
                                onChange={(e) => setScores((prev) => ({ ...prev, [etId]: e.target.value }))}
                              />
                              <span style={{ position: "absolute", right: "9px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#9CA3AF", pointerEvents: "none" }}>/ 100</span>
                            </div>
                            {below && <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#DC2626", fontWeight: "600" }}>Below minimum ({minR}%)</p>}
                          </div>
                        );
                      })}
                    </div>{/* end inner padding div */}
                  </div>
                );
              })}
            </div>

            {/* Breakdown + result */}
            {hasAnyScores && (
              <>
                <div style={{ borderRadius: "10px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#F9FAFB" }}>
                        <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "700", color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>Evidence</th>
                        <th style={{ padding: "7px 10px", textAlign: "center", fontWeight: "700", color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>Score</th>
                        <th style={{ padding: "7px 10px", textAlign: "center", fontWeight: "700", color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>Weight</th>
                        <th style={{ padding: "7px 10px", textAlign: "center", fontWeight: "700", color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>Weighted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.breakdown.map((row, i) => (
                        <tr key={row.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                          <td style={{ padding: "7px 10px", color: "#374151", fontWeight: "600", fontSize: "11px" }}>{row.name}</td>
                          <td style={{ padding: "7px 10px", textAlign: "center", color: row.belowMin ? "#DC2626" : "#374151", fontWeight: "700" }}>{row.score}%</td>
                          <td style={{ padding: "7px 10px", textAlign: "center", color: "#9CA3AF" }}>{row.contribution}%</td>
                          <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: "700", color: "#374151" }}>{row.weighted}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: "10px 14px", background: "#F9FAFB", borderTop: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#374151" }}>Final Score</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px", fontWeight: "800", color: bandColor }}>{result.finalScore}%</span>
                      {result.band && (
                        <span style={{ padding: "3px 12px", borderRadius: "20px", background: `${bandColor}15`, border: `1.5px solid ${bandColor}40`, fontSize: "12px", fontWeight: "700", color: bandColor }}>
                          {result.band.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {outcome && (
                  <div style={{ padding: "10px 14px", borderRadius: "8px", background: outcome.bg, border: `1.5px solid ${outcome.color}30`, display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: outcome.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", fontWeight: "700", color: outcome.color }}>{outcome.label}</span>
                  </div>
                )}

                {result.belowReq.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {result.belowReq.map((row) => (
                      <div key={row.id} style={{ padding: "7px 12px", borderRadius: "8px", background: "#DC262608", border: "1px solid #DC262625", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: "#DC2626" }}>{row.name}</span>
                        <span style={{ fontSize: "11px", color: "#DC2626" }}>scored {row.score}% — min {row.minRequirement}%</span>
                      </div>
                    ))}
                  </div>
                )}

              </>
            )}
          </>
        )}
        </div>{/* end scrollable calculator */}
      </div>
    </div>
  );
}

/* ── AssessmentsPanel ───────────────────────────────────────────────────── */

const AF_SECTIONS = [
  { key: "types",    label: "Types" },
  { key: "evidence", label: "Evidence Type" },
  { key: "scoring",  label: "Score Evidence" },
];

function AssessmentsPanel({ curriculumId }) {
  const [sub, setSub] = useState("types");

  return (
    <div className="cp-card">
      {/* Header + sub-nav on same row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Assessment Framework</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            Define assessment types, evidence methods, and scoring weights for this curriculum.
          </p>
        </div>
        <div className="cp-arc-section-nav" style={{ marginBottom: 0, flexShrink: 0 }}>
          {AF_SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`cp-arc-section-btn${sub === s.key ? " active" : ""}`}
              onClick={() => setSub(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {sub === "types"    && <AssessmentTypesSubPanel curriculumId={curriculumId} />}
      {sub === "evidence" && <EvidenceTypesSubPanel   curriculumId={curriculumId} />}
      {sub === "scoring"  && <ScoreEvidenceSubPanel   curriculumId={curriculumId} />}
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
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Developmental Stages</h3>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {cats.length === 0 ? "Define the developmental stages for this curriculum" : `${cats.length} stage${cats.length !== 1 ? "s" : ""} defined`}
          </p>
        </div>
        {mode === "list" && (
          <button type="button" className="cp-btn-primary" onClick={openAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Add Stage
          </button>
        )}
      </div>

      {mode !== "list" && (
        <div className="cp-comp-form-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>{mode === "edit" ? "Edit Stage" : "New Developmental Stage"}</h3>
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
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No developmental stages yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF", maxWidth: "300px", marginInline: "auto" }}>
            Create stages to organize the progress arc for different learner developmental phases.
          </p>
          <button type="button" className="cp-btn-ghost" onClick={openAdd}>+ Add First Stage</button>
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
                <span className="cp-add-card-label">Add Stage</span>
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
  const [minScore,   setMinScore]   = useState("0");
  const [maxScore,   setMaxScore]   = useState("100");
  const nameRef = useRef(null);

  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()   { setEditTarget(null); setName(""); setDesc(""); setMinScore("0"); setMaxScore("100"); setMode("add"); }
  function openEdit(l) { setEditTarget(l); setName(l.name); setDesc(l.description || ""); setMinScore(String(l.minScore ?? 0)); setMaxScore(String(l.maxScore ?? 100)); setMode("edit"); }
  function cancel()    { setMode("list"); setEditTarget(null); }

  function submit() {
    if (!name.trim()) return;
    const data = {
      name: name.trim(), description: desc.trim(),
      minScore: Math.min(100, Math.max(0, Number(minScore) || 0)),
      maxScore: Math.min(100, Math.max(0, Number(maxScore) || 100)),
    };
    if (mode === "edit") {
      update({ id: editTarget.id, data }, { onSuccess: cancel });
    } else {
      create(data, { onSuccess: () => { setName(""); setDesc(""); setMinScore("0"); setMaxScore("100"); nameRef.current?.focus(); } });
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
              <label className="cp-field-label">Score Range <span className="cp-required">*</span></label>
              <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>The score range that places a learner in this level.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "8px", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <input className="cp-input" type="number" min="0" max="100" style={{ width: "100%", boxSizing: "border-box", paddingRight: "30px" }}
                    placeholder="0" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
                  <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#9CA3AF", pointerEvents: "none" }}>min</span>
                </div>
                <span style={{ fontSize: "13px", color: "#9CA3AF", textAlign: "center" }}>–</span>
                <div style={{ position: "relative" }}>
                  <input className="cp-input" type="number" min="0" max="100" style={{ width: "100%", boxSizing: "border-box", paddingRight: "30px" }}
                    placeholder="100" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
                  <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#9CA3AF", pointerEvents: "none" }}>max</span>
                </div>
              </div>
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
                    <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", color: "#9CA3AF" }}>Level {level.order}</span>
                      {level.minScore != null && level.maxScore != null && (
                        <span style={{ fontSize: "10px", fontWeight: "700", color: color, background: `${color}12`, padding: "1px 7px", borderRadius: "20px" }}>
                          {level.minScore}–{level.maxScore}%
                        </span>
                      )}
                    </div>
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

/* ── PerformanceBandsPanel ───────────────────────────────────────────────── */

const BAND_PALETTE = ["#D97706","#059669","#2563EB","#7C3AED","#DC2626","#0891B2","#25476a","#BE185D"];

function PerformanceBandsPanel({ curriculumId }) {
  const { data: bands = [], isLoading }            = usePerformanceBands(curriculumId);
  const { mutate: create, isPending: creating }    = useCreatePerformanceBand(curriculumId);
  const { mutate: update, isPending: updating }    = useUpdatePerformanceBand(curriculumId);
  const { mutate: remove, isPending: deleting }    = useDeletePerformanceBand(curriculumId);
  const { mutate: reorder }                        = useReorderPerformanceBands(curriculumId);

  const [mode,       setMode]       = useState("list");
  const [editTarget, setEdit]       = useState(null);
  const [name,       setName]       = useState("");
  const [desc,       setDesc]       = useState("");
  const [criteria,   setCriteria]   = useState([]);
  const [newCrit,    setNewCrit]    = useState("");
  const [minScore,   setMinScore]   = useState("0");
  const [maxScore,   setMaxScore]   = useState("100");
  const nameRef    = useRef(null);
  const critRef    = useRef(null);

  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()  { setEdit(null); setName(""); setDesc(""); setCriteria([]); setNewCrit(""); setMinScore("0"); setMaxScore("100"); setMode("add"); }
  function openEdit(b){ setEdit(b); setName(b.name); setDesc(b.description || ""); setCriteria([...(b.criteria || [])]); setNewCrit(""); setMinScore(String(b.minScore ?? 0)); setMaxScore(String(b.maxScore ?? 100)); setMode("edit"); }
  function cancel()   { setMode("list"); setEdit(null); }

  function addCriterion() {
    const v = newCrit.trim();
    if (!v) return;
    setCriteria((prev) => [...prev, v]);
    setNewCrit("");
    critRef.current?.focus();
  }

  function removeCriterion(idx) {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    if (!name.trim()) return;
    const data = {
      name: name.trim(), description: desc.trim(), criteria,
      minScore: Math.min(100, Math.max(0, Number(minScore) || 0)),
      maxScore: Math.min(100, Math.max(0, Number(maxScore) || 100)),
    };
    if (mode === "edit") {
      update({ id: editTarget.id, data }, { onSuccess: cancel });
    } else {
      create(data, { onSuccess: () => { setName(""); setDesc(""); setCriteria([]); setNewCrit(""); setMinScore("0"); setMaxScore("100"); nameRef.current?.focus(); } });
    }
  }

  function moveUp(idx) {
    if (idx === 0) return;
    const ids = bands.map((b) => b.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorder(ids);
  }

  function moveDown(idx) {
    if (idx === bands.length - 1) return;
    const ids = bands.map((b) => b.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorder(ids);
  }

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Performance Bands</h3>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {bands.length === 0
              ? "Define the performance descriptors used across all progress levels"
              : `${bands.length} band${bands.length !== 1 ? "s" : ""} · ordered from lowest to highest`}
          </p>
        </div>
        {mode === "list" && (
          <button type="button" className="cp-btn-primary" onClick={openAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Add Band
          </button>
        )}
      </div>

      {/* Form */}
      {mode !== "list" && (
        <div className="cp-comp-form-card" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>
              {mode === "edit" ? "Edit Band" : "New Performance Band"}
            </h3>
            <button type="button" className="cp-icon-btn" onClick={cancel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Name */}
            <div>
              <label className="cp-field-label">Band Name <span className="cp-required">*</span></label>
              <input ref={nameRef} className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="e.g. Explorer, Builder, Creator, Innovator, Pioneer…"
                value={name} maxLength={100}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
              />
              <div className="cp-char-count">{name.length} / 100</div>
            </div>

            {/* Score Range */}
            <div>
              <label className="cp-field-label">Score Range <span className="cp-required">*</span></label>
              <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>The score range (0–100) that places a learner in this band.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "8px", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <input className="cp-input" type="number" min="0" max="100" style={{ width: "100%", boxSizing: "border-box", paddingRight: "30px" }}
                    placeholder="0" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
                  <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#9CA3AF", pointerEvents: "none" }}>min</span>
                </div>
                <span style={{ fontSize: "13px", color: "#9CA3AF", textAlign: "center" }}>–</span>
                <div style={{ position: "relative" }}>
                  <input className="cp-input" type="number" min="0" max="100" style={{ width: "100%", boxSizing: "border-box", paddingRight: "30px" }}
                    placeholder="100" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
                  <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#9CA3AF", pointerEvents: "none" }}>max</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="cp-field-label">Description <span className="cp-optional">(optional)</span></label>
              <textarea className="cp-textarea" rows={2}
                placeholder="Briefly describe what this performance band represents…"
                value={desc} maxLength={1000}
                onChange={(e) => setDesc(e.target.value)}
              />
              <div className="cp-char-count">{desc.length} / 1000</div>
            </div>

            {/* Criteria */}
            <div>
              <label className="cp-field-label">Performance Indicators <span className="cp-optional">(optional)</span></label>
              <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>
                Observable behaviours or checkpoints that place a learner in this band.
              </p>
              {criteria.length > 0 && (
                <ul style={{ margin: "0 0 10px", padding: "0 0 0 4px", listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {criteria.map((c, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "7px 10px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
                      <span style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "2px", flexShrink: 0, fontWeight: "700" }}>#{i + 1}</span>
                      <span style={{ flex: 1, fontSize: "13px", color: "#374151", lineHeight: "1.5" }}>{c}</span>
                      <button type="button" className="cp-icon-btn danger" style={{ flexShrink: 0 }} onClick={() => removeCriterion(i)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <input ref={critRef} className="cp-input" style={{ flex: 1 }}
                  placeholder="Add a performance indicator…"
                  value={newCrit} maxLength={500}
                  onChange={(e) => setNewCrit(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCriterion(); } }}
                />
                <button type="button" className="cp-btn-secondary" onClick={addCriterion} disabled={!newCrit.trim()}>Add</button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
            <button type="button" className="cp-btn-primary" onClick={submit} disabled={(creating || updating) || !name.trim()}>
              {creating || updating ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Band"}
            </button>
            <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {bands.length === 0 && mode === "list" && (
        <div className="cp-empty">
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>🏅</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No performance bands yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF", maxWidth: "320px", marginInline: "auto" }}>
            Bands like Explorer, Builder, and Pioneer give learners and teachers clear language for where performance sits.
          </p>
          <button type="button" className="cp-btn-ghost" onClick={openAdd}>+ Add First Band</button>
        </div>
      )}

      {/* Band cards — ordered list with move arrows */}
      {bands.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {bands.map((band, idx) => {
            const color     = BAND_PALETTE[idx % BAND_PALETTE.length];
            const isEditing = mode === "edit" && editTarget?.id === band.id;
            return (
              <div key={band.id} style={{
                background: "#fff", border: `1.5px solid ${isEditing ? "#25476a" : "#E5E7EB"}`,
                borderRadius: "16px", padding: "18px 20px",
                boxShadow: isEditing ? "0 0 0 3px rgba(37,71,106,0.08)" : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  {/* Order badge + move arrows */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flexShrink: 0, paddingTop: "2px" }}>
                    <button type="button" className="cp-icon-btn" onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "10px",
                      background: `${color}18`, border: `2px solid ${color}35`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: "800", color,
                    }}>
                      {idx + 1}
                    </div>
                    <button type="button" className="cp-icon-btn" onClick={() => moveDown(idx)} disabled={idx === bands.length - 1} title="Move down">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{
                          display: "inline-block", padding: "3px 12px", borderRadius: "20px",
                          background: `${color}18`, border: `1.5px solid ${color}35`,
                          fontSize: "13px", fontWeight: "800", color,
                        }}>
                          {band.name}
                        </span>
                        {(band.minScore != null && band.maxScore != null) && (
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#6B7280", background: "#F3F4F6", padding: "2px 8px", borderRadius: "20px" }}>
                            {band.minScore}–{band.maxScore}%
                          </span>
                        )}
                        {(band.criteria || []).length > 0 && (
                          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
                            {band.criteria.length} indicator{band.criteria.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <CardKebab onEdit={() => openEdit(band)} onDelete={() => remove(band.id)} disabled={deleting} />
                    </div>

                    {band.description && (
                      <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6B7280", lineHeight: "1.6" }}>{band.description}</p>
                    )}

                    {(band.criteria || []).length > 0 && (
                      <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "5px" }}>
                        {band.criteria.map((c, i) => (
                          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", color: "#374151" }}>
                            <span style={{ color, flexShrink: 0, marginTop: "1px", fontWeight: "700" }}>›</span>
                            <span style={{ lineHeight: "1.55" }}>{c}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add inline */}
          {mode === "list" && (
            <button type="button" className="cp-btn-add" style={{ alignSelf: "flex-start" }} onClick={openAdd}>
              + Add Band
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── ProgressArcPanel ────────────────────────────────────────────────────── */

const ARC_SECTIONS = [
  { key: "age-categories", label: "Developmental Stages" },
  { key: "levels",         label: "Levels" },
  { key: "bands",          label: "Performance Bands" },
  { key: "competencies",   label: "Competencies" },
];

function ProgressArcPanel({ curriculumId, arcSub = "age-categories", onArcSubChange }) {
  const setArcSub = onArcSubChange ?? (() => {});

  return (
    <div className="cp-card">
      <div className="cp-arc-section-header">
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Progress Arc</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            Define developmental stages, proficiency levels, and view competencies in context.
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

      {arcSub === "age-categories" && <AgeCategoriesPanel    curriculumId={curriculumId} />}
      {arcSub === "levels"         && <LevelsPanel           curriculumId={curriculumId} />}
      {arcSub === "bands"          && <PerformanceBandsPanel curriculumId={curriculumId} />}
      {arcSub === "competencies"   && <ArcCompetenciesPanel  curriculumId={curriculumId} />}
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

  useEffect(() => {
    const el = document.createElement("style");
    el.id = "cp-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("cp-styles")?.remove(); };
  }, []);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

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
