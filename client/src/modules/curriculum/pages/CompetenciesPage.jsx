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
} from "../../competencies/hooks/useCompetencies";

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

/* ── CompetenciesPanel ──────────────────────────────────────────────────── */

function CompetenciesPanel({ curriculumId }) {
  const { data: areas = [] }        = useLearningAreas(curriculumId);
  const { data: comps = [], isLoading } = useCompetencies(curriculumId);
  const { mutate: create, isPending: creating } = useCreateCompetency(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateCompetency(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteCompetency(curriculumId);

  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [name,      setName]      = useState("");
  const [desc,      setDesc]      = useState("");
  const [areaId,    setAreaId]    = useState("");
  const nameRef = useRef(null);

  useEffect(() => { if (showForm) nameRef.current?.focus(); }, [showForm]);

  function openCreate() {
    setEditId(null); setName(""); setDesc(""); setAreaId(""); setShowForm(true);
  }
  function openEdit(comp) {
    setEditId(comp.id); setName(comp.name); setDesc(comp.description || ""); setAreaId(comp.learningAreaId || ""); setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditId(null); }

  function submit() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: desc.trim(), learningAreaId: areaId || null };
    if (editId) {
      update({ id: editId, data }, { onSuccess: cancel });
    } else {
      create(data, { onSuccess: cancel });
    }
  }

  const areaMap = Object.fromEntries(areas.map((a) => [a.id, a]));

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "32px" }} />;

  return (
    <div className="cp-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Competencies</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {comps.length} competenc{comps.length !== 1 ? "ies" : "y"} — e.g. Communication, Critical Thinking, Creativity
          </p>
        </div>
        {!showForm && (
          <button type="button" className="cp-btn-add" onClick={openCreate}>
            + Add Competency
          </button>
        )}
      </div>

      {showForm && (
        <div className="cp-form">
          <div className="cp-form-row">
            <input
              ref={nameRef}
              className="cp-input"
              placeholder="Competency name (e.g. Communication)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
            />
            <select
              className="cp-select"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              <option value="">No area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <textarea
            className="cp-textarea"
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button type="button" className="cp-btn-primary" onClick={submit} disabled={creating || updating || !name.trim()}>
              {creating || updating ? "Saving…" : editId ? "Update" : "Create"}
            </button>
            <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {comps.length === 0 && !showForm ? (
        <div className="cp-empty">
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>🎯</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No competencies yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF" }}>
            Add the core competencies learners should develop through this curriculum.
          </p>
          <button type="button" className="cp-btn-ghost" onClick={openCreate}>+ Add First Competency</button>
        </div>
      ) : (
        <div className="cp-list">
          {comps.map((comp) => {
            const area = areaMap[comp.learningAreaId];
            return (
              <div key={comp.id} className="cp-item">
                {area && <div className="cp-item-dot" style={{ backgroundColor: area.color || "#25476a" }} />}
                {!area && <div className="cp-item-dot" style={{ backgroundColor: "#E5E7EB" }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cp-item-name">{comp.name}</div>
                  {comp.description && <div className="cp-item-sub">{comp.description}</div>}
                </div>
                {area && <span className="cp-item-badge" style={{ backgroundColor: `${area.color}18`, color: area.color, borderColor: `${area.color}44` }}>{area.name}</span>}
                <button type="button" className="cp-icon-btn" onClick={() => openEdit(comp)} title="Edit">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button type="button" className="cp-icon-btn danger" onClick={() => remove(comp.id)} disabled={deleting} title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            );
          })}
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

/* ── AssessmentsPanel (stub) ────────────────────────────────────────────── */

function AssessmentsPanel() {
  return (
    <div className="cp-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Assessments</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            Define how competencies are assessed at each stage of the progress arc.
          </p>
        </div>
      </div>
      <div className="cp-empty">
        <div style={{ fontSize: "32px", marginBottom: "10px" }}>📝</div>
        <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>Assessments coming soon</p>
        <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
          This section will let you define assessment criteria and rubrics tied to competencies.
        </p>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */

export default function CompetenciesPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { data: curriculum } = useCurriculumQuery(id);

  const [activeNav, setActiveNav] = useState("competencies");

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
        {[
          { key: "competencies", label: "Competencies" },
          { key: "areas",        label: "Learning Areas" },
          { key: "ladder",       label: "Progress Arc" },
          { key: "assessments",  label: "Assessments" },
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
      </div>

      {/* ── Panels ──────────────────────────────────────────────────── */}
      {activeNav === "competencies" && <CompetenciesPanel        curriculumId={id} />}
      {activeNav === "areas"        && <LearningAreasPanel       curriculumId={id} />}
      {activeNav === "ladder"       && <ProgressionLadderPanel   curriculumId={id} />}
      {activeNav === "assessments"  && <AssessmentsPanel />}
    </div>
  );
}
