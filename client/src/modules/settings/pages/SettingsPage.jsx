import { useState, useEffect, useRef } from "react";
import {
  useCompetencies, useCreateCompetency, useUpdateCompetency, useDeleteCompetency,
  useIndicators, useCreateIndicator, useUpdateIndicator, useDeleteIndicator,
} from "../hooks/useCompetencies";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const PALETTE = [
  "#25476a", "#38aae1", "#059669", "#7C3AED",
  "#DC2626", "#D97706", "#0891B2", "#BE185D",
  "#2e7db5", "#0A3880",
];

/* ── CSS ────────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes stg-fadein { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes stg-spin    { to { transform:rotate(360deg); } }

  .stg-card {
    background:#fff; border-radius:16px; padding:22px 24px;
    box-shadow:0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04);
  }

  .stg-btn-primary {
    padding:10px 20px; background:#feb139; color:#25476a; border:none; border-radius:10px;
    font-size:13px; font-weight:700; font-family:Inter,sans-serif; cursor:pointer;
    display:inline-flex; align-items:center; gap:7px; transition:background 0.15s, transform 0.1s; white-space:nowrap;
  }
  .stg-btn-primary:hover:not(:disabled) { background:#f5a827; }
  .stg-btn-primary:active:not(:disabled) { transform:scale(0.98); }
  .stg-btn-primary:disabled { background:#fde3b0; cursor:not-allowed; }

  .stg-btn-secondary {
    padding:9px 16px; background:#fff; color:#374151; border:1.5px solid #E5E7EB;
    border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; transition:all 0.15s; white-space:nowrap;
  }
  .stg-btn-secondary:hover { background:#F3F4F6; }

  .stg-input, .stg-textarea {
    padding:10px 12px; border-radius:10px; border:1.5px solid #E5E7EB;
    font-size:14px; font-family:Inter,sans-serif; background:#F9FAFB;
    color:#374151; outline:none; width:100%; box-sizing:border-box;
    transition:border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .stg-input:focus, .stg-textarea:focus {
    border-color:#38aae1; background:#fff; box-shadow:0 0 0 3px rgba(56,170,225,0.12);
  }
  .stg-textarea { resize:vertical; }

  .stg-spinner {
    width:22px; height:22px; border:2.5px solid #E5E7EB; border-top-color:#25476a;
    border-radius:50%; animation:stg-spin 0.7s linear infinite; margin:60px auto;
  }

  .stg-empty {
    text-align:center; padding:56px 24px; background:#fff;
    border:2px dashed #E5E7EB; border-radius:16px; animation:stg-fadein 0.2s ease;
  }

  .stg-grid {
    display:grid; grid-template-columns:repeat(auto-fill, minmax(272px,1fr));
    gap:16px; align-items:start;
  }
  @media(max-width:560px){ .stg-grid { grid-template-columns:1fr; } }

  .stg-comp-card {
    position:relative; background:#fff; border:1.5px solid #E5E7EB; border-radius:16px;
    padding:18px 20px; display:flex; flex-direction:column;
    transition:border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    animation:stg-fadein 0.18s ease;
  }
  .stg-comp-card:hover {
    border-color:#b8d9ee; box-shadow:0 6px 20px rgba(37,71,106,0.1); transform:translateY(-2px);
  }
  .stg-comp-card-top { display:flex; align-items:flex-start; gap:12px; margin-bottom:10px; }
  .stg-avatar {
    width:44px; height:44px; border-radius:12px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:18px; font-weight:800;
  }
  .stg-comp-desc {
    margin:0 0 12px; font-size:12.5px; color:#6B7280; line-height:1.6;
    display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
    flex:1;
  }
  .stg-chip-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
  .stg-chip {
    display:inline-flex; align-items:center; gap:5px; padding:4px 10px;
    border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap;
  }

  .stg-kebab-btn {
    width:28px; height:28px; border-radius:8px; border:none; background:transparent;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    color:#D1D5DB; transition:background 0.12s, color 0.12s; flex-shrink:0;
  }
  .stg-kebab-btn:hover { background:#F3F4F6; color:#374151; }
  .stg-menu {
    position:absolute; top:calc(100% + 4px); right:0; z-index:200;
    background:#fff; border:1px solid #E5E7EB; border-radius:10px;
    box-shadow:0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06);
    min-width:140px; padding:4px; animation:stg-fadein 0.12s ease;
  }
  .stg-menu-item {
    display:flex; align-items:center; gap:8px; width:100%;
    padding:8px 10px; border:none; border-radius:7px; background:transparent;
    font-size:12px; font-weight:600; font-family:Inter,sans-serif; color:#374151;
    cursor:pointer; text-align:left; transition:background 0.1s, color 0.1s;
  }
  .stg-menu-item:hover { background:#F3F4F6; color:#111827; }
  .stg-menu-item--danger { color:#DC2626; }
  .stg-menu-item--danger:hover { background:#FEF2F2; }

  .stg-indicators-toggle {
    display:flex; align-items:center; justify-content:space-between; width:100%;
    padding-top:12px; border-top:1px solid #F3F4F6; background:none; border-left:none;
    border-right:none; border-bottom:none; cursor:pointer; font-family:Inter,sans-serif;
  }
  .stg-indicators-toggle span:first-child { font-size:11.5px; font-weight:700; color:#374151; }
  .stg-indicator-count {
    font-size:10.5px; font-weight:700; padding:1px 8px; border-radius:20px;
    background:#F3F4F6; color:#6B7280;
  }
  .stg-chevron { transition:transform 0.15s; color:#9CA3AF; }
  .stg-chevron.open { transform:rotate(180deg); }

  .stg-indicators-body { margin-top:10px; animation:stg-fadein 0.15s ease; }
  .stg-indicator-row {
    display:flex; align-items:center; gap:8px; padding:6px 10px;
    background:#F9FAFB; border:1px solid #F3F4F6; border-radius:8px; margin-bottom:6px;
  }
  .stg-indicator-row span { flex:1; font-size:12.5px; color:#374151; }
  .stg-indicator-x {
    background:none; border:none; color:#9CA3AF; cursor:pointer; font-size:15px;
    line-height:1; padding:0; transition:color 0.1s;
  }
  .stg-indicator-x:hover { color:#DC2626; }
  .stg-indicator-add-row { display:flex; gap:8px; }
  .stg-indicator-add-btn {
    background:none; border:none; color:#38aae1; font-size:12px; font-weight:700;
    cursor:pointer; padding:0; font-family:Inter,sans-serif;
  }
  .stg-indicator-add-btn:hover { color:#25476a; }

  .stg-modal-overlay {
    position:fixed; inset:0; z-index:1000; background:rgba(15,38,69,0.45);
    display:flex; align-items:flex-start; justify-content:center;
    padding:40px 16px; overflow-y:auto; animation:stg-fadein 0.15s ease;
  }
  .stg-modal {
    background:#fff; border-radius:18px; width:100%; max-width:480px;
    box-shadow:0 24px 64px rgba(0,0,0,0.25); overflow:hidden;
  }
  .stg-modal-header {
    padding:20px 24px; background:linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%);
  }
  .stg-modal-close {
    background:rgba(255,255,255,0.12); border:none; color:#fff; cursor:pointer;
    font-size:16px; line-height:1; width:26px; height:26px; border-radius:8px;
    display:flex; align-items:center; justify-content:center; transition:background 0.12s;
  }
  .stg-modal-close:hover { background:rgba(255,255,255,0.22); }
  .stg-field-label {
    font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:5px;
  }
`;

function Label({ children }) {
  return <span className="stg-field-label">{children}</span>;
}

function Modal({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="stg-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stg-modal">
        <div className="stg-modal-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>{title}</h2>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{subtitle}</p>}
          </div>
          <button type="button" className="stg-modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: "22px 24px" }}>{children}</div>
        <div style={{ padding: "16px 24px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

function CardKebab({ onEdit, onDelete }) {
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
      <button type="button" className="stg-kebab-btn" onClick={() => setOpen((v) => !v)} title="Options">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div className="stg-menu">
          <button type="button" className="stg-menu-item" onClick={() => { setOpen(false); onEdit(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit
          </button>
          <button type="button" className="stg-menu-item stg-menu-item--danger" onClick={() => { setOpen(false); onDelete(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Indicators (nested under a Competency) ───────────────────────────── */

function IndicatorsSection({ competencyId, expanded, onToggle }) {
  const { data: indicators = [] } = useIndicators(competencyId, expanded);
  const { mutate: createIndicator } = useCreateIndicator(competencyId);
  const { mutate: deleteIndicator } = useDeleteIndicator(competencyId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    createIndicator({ name: name.trim() }, { onSuccess: () => { setName(""); setAdding(false); } });
  };

  return (
    <>
      <button type="button" className="stg-indicators-toggle" onClick={onToggle}>
        <span>Indicators</span>
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="stg-indicator-count">{indicators.length || (expanded ? 0 : "…")}</span>
          <svg className={`stg-chevron${expanded ? " open" : ""}`} width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {expanded && (
        <div className="stg-indicators-body">
          {indicators.length === 0 && !adding && (
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No indicators added</p>
          )}
          {indicators.map((ind) => (
            <div key={ind.id} className="stg-indicator-row">
              <span>{ind.name}</span>
              <button type="button" className="stg-indicator-x" onClick={() => deleteIndicator(ind.id)}>×</button>
            </div>
          ))}
          {adding ? (
            <div className="stg-indicator-add-row">
              <input
                autoFocus className="stg-input" style={{ flex: 1, padding: "7px 10px", fontSize: "12.5px" }}
                value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Indicator name"
              />
              <button type="button" onClick={submit} style={{ padding: "0 14px", background: "#25476a", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Add</button>
              <button type="button" onClick={() => { setAdding(false); setName(""); }} style={{ padding: "0 10px", background: "none", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontSize: "12px", color: "#6B7280", cursor: "pointer" }}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="stg-indicator-add-btn" onClick={() => setAdding(true)}>+ Add Indicator</button>
          )}
        </div>
      )}
    </>
  );
}

/* ── Competencies ──────────────────────────────────────────────────────── */

function CompetencyModal({ editTarget, onClose }) {
  const { mutate: create, isPending: creating } = useCreateCompetency();
  const { mutate: update, isPending: updating } = useUpdateCompetency();
  const isPending = creating || updating;

  const [form, setForm] = useState(() => ({
    name: editTarget?.name || "",
    description: editTarget?.description || "",
    minimumThreshold: editTarget?.minimumThreshold ?? 60,
    weight: editTarget?.weight ?? 0,
  }));
  const [error, setError] = useState("");
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      minimumThreshold: Number(form.minimumThreshold),
      weight: Number(form.weight),
    };
    const onSuccess = () => onClose();
    if (editTarget) update({ id: editTarget.id, data }, { onSuccess });
    else create(data, { onSuccess });
  };

  return (
    <Modal
      title={editTarget ? "Edit Competency" : "Add Competency"}
      subtitle="Shared across Curriculum, Courses, and Assessments"
      onClose={onClose}
      footer={<>
        <button type="button" className="stg-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="stg-btn-primary" onClick={submit} disabled={isPending}>
          {isPending ? "Saving…" : editTarget ? "Save Changes" : "Add Competency"}
        </button>
      </>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && <div style={{ padding: "10px 14px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "10px", color: "#EF4444", fontSize: "13px" }}>{error}</div>}
        <div>
          <Label>Name *</Label>
          <input className="stg-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Computational Thinking" />
        </div>
        <div>
          <Label>Description</Label>
          <textarea rows={3} className="stg-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <Label>Minimum Threshold (%)</Label>
            <input type="number" min="0" max="100" className="stg-input" value={form.minimumThreshold} onChange={(e) => setField("minimumThreshold", e.target.value)} />
          </div>
          <div>
            <Label>Default Weight (%)</Label>
            <input type="number" min="0" max="100" className="stg-input" value={form.weight} onChange={(e) => setField("weight", e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CompetencyCard({ comp, color, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const initial = comp.name.charAt(0).toUpperCase();

  return (
    <div className="stg-comp-card">
      <div className="stg-comp-card-top">
        <div className="stg-avatar" style={{ backgroundColor: `${color}15`, border: `2px solid ${color}30`, color }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
          <p style={{ margin: 0, fontSize: "14.5px", fontWeight: "700", color: "#111827", lineHeight: 1.3, wordBreak: "break-word" }}>
            {comp.name}
          </p>
        </div>
        <CardKebab onEdit={onEdit} onDelete={onDelete} />
      </div>

      <p className="stg-comp-desc">
        {comp.description || <em style={{ color: "#D1D5DB" }}>No description added</em>}
      </p>

      <div className="stg-chip-row">
        <span className="stg-chip" style={{ backgroundColor: "#F0F7FF", color: "#25476a" }}>
          Threshold {comp.minimumThreshold ?? 60}%
        </span>
        <span className="stg-chip" style={{ backgroundColor: "#FFF8E6", color: "#92400E" }}>
          Weight {comp.weight ?? 0}%
        </span>
      </div>

      <IndicatorsSection competencyId={comp.id} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
    </div>
  );
}

function CompetenciesPanel() {
  const { data: competencies = [], isLoading } = useCompetencies();
  const { mutate: deleteCompetency } = useDeleteCompetency();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  if (isLoading) return <div className="stg-spinner" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Competencies</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {competencies.length} competenc{competencies.length !== 1 ? "ies" : "y"} defined
          </p>
        </div>
        <button type="button" className="stg-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          + Add Competency
        </button>
      </div>

      {competencies.length === 0 ? (
        <div className="stg-empty">
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎯</div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No competencies yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Define competencies here so Curriculum, Courses, and Assessments can all share the same catalog.
          </p>
          <button type="button" className="stg-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            + Add Competency
          </button>
        </div>
      ) : (
        <div className="stg-grid">
          {competencies.map((comp, idx) => (
            <CompetencyCard
              key={comp.id}
              comp={comp}
              color={PALETTE[idx % PALETTE.length]}
              onEdit={() => { setEditTarget(comp); setModalOpen(true); }}
              onDelete={() => setDeleteTarget(comp)}
            />
          ))}
        </div>
      )}

      {modalOpen && <CompetencyModal editTarget={editTarget} onClose={() => setModalOpen(false)} />}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Competency"
        message={`"${deleteTarget?.name}" will be permanently deleted, including its indicators, and removed from every curriculum that uses it. This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { deleteCompetency(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "settings-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("settings-styles")?.remove(); };
  }, []);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", position: "relative" }}>Settings</h1>
        <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px", position: "relative" }}>
          Define competencies here once — Curriculum, Courses, and Assessments all reference this shared catalog instead of each defining their own. Learning areas and per-curriculum grouping are managed within each curriculum.
        </p>
      </div>

      <div className="stg-card">
        <CompetenciesPanel />
      </div>
    </div>
  );
}
