import { useState, useEffect, useRef } from "react";
import { FiChevronDown, FiEdit2, FiMoreVertical, FiSearch, FiTarget, FiTrash2 } from "react-icons/fi";
import {
  useCompetencies, useCreateCompetency, useUpdateCompetency, useDeleteCompetency,
} from "../hooks/useCompetencies";
import { Modal, Label } from "../../components/Modal";
import { PALETTE } from "../../palette";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

const STOP_WORDS = new Set(["the", "and", "of", "for", "a", "an", "in", "on", "at", "to", "by", "with", "from", "or"]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractWords(name) {
  const cleaned = normalizeText(name)
    .replace(/^\d+(?:[.)-]\s*|\s+)/, "")
    .replace(/^[ivxlcdm]+\.\s*/i, "");

  return cleaned
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !STOP_WORDS.has(part.toLowerCase()));
}

function codeFromName(name, fallback, maxLetters = 6) {
  const words = extractWords(name);
  if (words.length === 0) return fallback;

  let code = words.map((word) => word[0].toUpperCase()).join("");
  if (code.length < 2) {
    code = words[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }

  code = code.slice(0, maxLetters).replace(/[^a-zA-Z0-9]/g, "");
  return code || fallback;
}

function previewCompetencyCode(name) {
  return codeFromName(name, "");
}

function previewIndicatorCode(competencyName, indicatorName) {
  const compCode = previewCompetencyCode(competencyName);
  const indCode = codeFromName(indicatorName, "");
  if (!compCode || !indCode) return "";
  return `${compCode}-${indCode}`;
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
        <FiMoreVertical size={14} strokeWidth={2} />
      </button>
      {open && (
        <div className="stg-menu">
          <button type="button" className="stg-menu-item" onClick={() => { setOpen(false); onEdit(); }}>
            <FiEdit2 size={13} strokeWidth={2} />
            Edit
          </button>
          <button type="button" className="stg-menu-item stg-menu-item--danger" onClick={() => { setOpen(false); onDelete(); }}>
            <FiTrash2 size={13} strokeWidth={2} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function IndicatorsEditor({ competencyName, indicators, onChange }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const previewCode = previewIndicatorCode(competencyName, name);

  const addIndicator = () => {
    if (!name.trim()) return;
    onChange([...indicators, { name: name.trim(), description: description.trim() }]);
    setName("");
    setDescription("");
  };

  const removeIndicator = (idx) => onChange(indicators.filter((_, i) => i !== idx));

  return (
    <div>
      <Label>Indicators</Label>
      <p style={{ margin: "0 0 8px", fontSize: "11.5px", color: "#9CA3AF" }}>
        How can this competency be recognized when a learner demonstrates it? Add as many as you need.
      </p>

      {indicators.length > 0 && (
        <div style={{ marginBottom: "10px" }}>
          {indicators.map((ind, idx) => (
            <div key={ind.id || idx} className="stg-ind-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: "12.5px", fontWeight: "700", color: "#374151" }}>{ind.name}</p>
                  {ind.code && <span className="stg-code-pill stg-code-pill--small">{ind.code}</span>}
                </div>
                {ind.description && (
                  <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>{ind.description}</p>
                )}
              </div>
              <button type="button" className="stg-ind-x" onClick={() => removeIndicator(idx)}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="stg-ind-add-card">
        <input
          className="stg-input stg-ind-add-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Indicator name (e.g. Breaks a problem into smaller steps)"
        />
        {previewCode && (
          <p style={{ margin: "0", fontSize: "11.5px", color: "#6B7280" }}>
            Code preview: <strong style={{ color: "#25476a" }}>{previewCode}</strong>
          </p>
        )}
        <input
          className="stg-input stg-ind-add-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
        />
        <button type="button" className="stg-btn-secondary" onClick={addIndicator} disabled={!name.trim()}>
          + Add Indicator
        </button>
      </div>
    </div>
  );
}

function CompetencyModal({ editTarget, onClose }) {
  const { mutate: create, isPending: creating } = useCreateCompetency();
  const { mutate: update, isPending: updating } = useUpdateCompetency();
  const isPending = creating || updating;

  const [form, setForm] = useState(() => ({
    name: editTarget?.name || "",
    description: editTarget?.description || "",
  }));
  const [indicators, setIndicators] = useState(() => editTarget?.indicators || []);
  const [error, setError] = useState("");
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const codePreview = previewCompetencyCode(form.name);

  const submit = () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      indicators,
    };
    const onSuccess = () => onClose();
    if (editTarget) update({ id: editTarget.id, data }, { onSuccess });
    else create(data, { onSuccess });
  };

  return (
    <Modal
      title={editTarget ? "Edit Competency" : "Add Competency"}
      subtitle="Shared across Curriculum, Courses, and Assessments. Codes are generated automatically."
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
        {codePreview && (
          <div>
            <Label>Code preview</Label>
            <div className="stg-code-preview-row">
              <span className="stg-code-pill">{codePreview}</span>
              <span style={{ fontSize: "12px", color: "#9CA3AF" }}>Generated from the competency name and used to track it everywhere.</span>
            </div>
          </div>
        )}
        <div>
          <Label>Name *</Label>
          <input className="stg-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Computational Thinking" />
        </div>
        <div>
          <Label>Description</Label>
          <textarea rows={4} className="stg-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} />
        </div>
        <IndicatorsEditor competencyName={form.name} indicators={indicators} onChange={setIndicators} />
      </div>
    </Modal>
  );
}

function CompetencyCard({ comp, color, onEdit, onDelete }) {
  const initial = comp.name.charAt(0).toUpperCase();
  const indicators = comp.indicators || [];
  const [open, setOpen] = useState(false);

  return (
    <div className="stg-comp-card">
        <div className="stg-comp-card-top">
          <div className="stg-avatar" style={{ backgroundColor: `${color}15`, border: `2px solid ${color}30`, color }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: "14.5px", fontWeight: "700", color: "#111827", lineHeight: 1.3, wordBreak: "break-word" }}>
                {comp.name}
              </p>
              {comp.code && <span className="stg-code-pill">{comp.code}</span>}
            </div>
          </div>
        <CardKebab onEdit={onEdit} onDelete={onDelete} />
      </div>

      <p className="stg-comp-desc">
        {comp.description || <em style={{ color: "#D1D5DB" }}>No description added</em>}
      </p>

      {indicators.length > 0 && (
        <div>
          <button type="button" className="stg-comp-ind-toggle" onClick={() => setOpen((v) => !v)}>
            <span>{indicators.length} indicator{indicators.length !== 1 ? "s" : ""}</span>
            <FiChevronDown className={`stg-comp-ind-chevron${open ? " open" : ""}`} size={12} strokeWidth={2} />
          </button>
          {open && (
            <div className="stg-comp-ind-list">
              {indicators.map((ind, idx) => (
                <div key={ind.id || idx} className="stg-comp-ind-item">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#374151" }}>{ind.name}</p>
                    {ind.code && <span className="stg-code-pill stg-code-pill--small">{ind.code}</span>}
                  </div>
                  {ind.description && (
                    <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>{ind.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CompetenciesPanel() {
  const { data: competencies = [], isLoading } = useCompetencies();
  const { mutate: deleteCompetency } = useDeleteCompetency();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredComps = query ? competencies.filter((c) => c.name.toLowerCase().includes(query)) : competencies;

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
          <div style={{ marginBottom: "12px", color: "#25476a" }}>
            <FiTarget size={40} strokeWidth={1.8} />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No competencies yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Define competencies here so Curriculum, Courses, and Assessments can all share the same catalog.
          </p>
          <button type="button" className="stg-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            + Add Competency
          </button>
        </div>
      ) : (
        <>
          <div className="stg-search-wrap">
            <FiSearch size={14} className="stg-search-icon" />
            <input
              className="stg-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${competencies.length} competenc${competencies.length !== 1 ? "ies" : "y"}…`}
            />
          </div>

          {filteredComps.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ marginBottom: "10px", color: "#25476a" }}>
                <FiSearch size={32} strokeWidth={1.8} />
              </div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#374151" }}>No matches for "{search}"</p>
            </div>
          ) : (
            <div className="stg-grid">
              {filteredComps.map((comp) => (
                <CompetencyCard
                  key={comp.id}
                  comp={comp}
                  color={PALETTE[competencies.findIndex((c) => c.id === comp.id) % PALETTE.length]}
                  onEdit={() => { setEditTarget(comp); setModalOpen(true); }}
                  onDelete={() => setDeleteTarget(comp)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modalOpen && <CompetencyModal editTarget={editTarget} onClose={() => setModalOpen(false)} />}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Competency"
        message={`"${deleteTarget?.name}" will be permanently deleted and removed from every curriculum that uses it, including any thresholds, weights, and indicators those curricula defined for it. This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { deleteCompetency(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
