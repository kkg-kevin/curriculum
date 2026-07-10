import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useAssessmentQuery, useCreateAssessment, useUpdateAssessment,
  useAssessmentCompetencies, useAssessmentLearningAreas, useAssessmentInventory,
} from "../hooks/useAssessment";
import { assessmentApi } from "../services/assessmentApi";
import { useCompetencies } from "../../settings/competencies/hooks/useCompetencies";
import { useLearningAreas } from "../../settings/learning-areas/hooks/useLearningAreas";
import { useInventory } from "../../settings/inventory/hooks/useInventory";
import { INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_ICONS } from "../../settings/inventory/constants";
import { FiPlus, FiX, FiPackage } from "react-icons/fi";
import CreateCompetencyModal from "../../courses/components/CreateCompetencyModal";
import CreateLearningAreaModal from "../../courses/components/CreateLearningAreaModal";
import CreateInventoryItemModal from "../../courses/components/CreateInventoryItemModal";
import RichTextEditor from "../components/RichTextEditor";
import RichContent, { stripHtml, isEmptyHtml } from "../components/RichContent";
import {
  STRUCTURE_MODES, STRUCTURE_MODE_LABELS, ITEM_GROUPS, ITEM_GROUP_LABELS, ITEM_GROUP_COLORS,
  ITEM_KIND_LABELS, OBSERVATION_ITEM_KINDS, TASK_TYPES, TASK_TYPE_LABELS, SUBMISSION_ITEM_KINDS,
  BUILDER_REGISTRY, normalizeLegacyItem,
} from "../schemas/assessment.schema";

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", assignment: "Assignment", project: "Project", observation: "Teacher Observation" };
const TYPE_COLORS = { quiz: "#25476a", exam: "#38aae1", project: "#7C3AED", assignment: "#059669", observation: "#D97706" };
const TYPE_ICONS = { quiz: "📝", exam: "🎓", project: "🛠️", assignment: "📄", observation: "👁️" };
const TAG_PALETTE = ["#25476a", "#38aae1", "#059669", "#7C3AED", "#DC2626", "#D97706", "#0891B2", "#BE185D"];

function genId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
}

/* ── CSS ────────────────────────────────────────────────────────────────── */

const CSS = `
  .tb-page { font-family: Inter, sans-serif; }
  .tb-header {
    display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
    padding:18px 24px; background:#fff; border-bottom:1.5px solid #E5E7EB; margin-bottom:18px;
  }
  .tb-crumb { font-size:12px; color:#9CA3AF; margin-bottom:4px; }
  .tb-crumb a { color:#38aae1; text-decoration:none; cursor:pointer; }
  .tb-title-row { display:flex; align-items:center; gap:12px; min-width:0; }
  .tb-title-text { min-width:0; }
  .tb-title, .tb-subtitle { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60vw; }
  .tb-title-icon {
    width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center;
    font-size:18px; flex-shrink:0;
  }
  .tb-title { margin:0; font-size:18px; font-weight:800; color:#0F2645; }
  .tb-subtitle { margin:2px 0 0; font-size:12.5px; color:#9CA3AF; }
  .tb-actions { display:flex; gap:10px; flex-shrink:0; }
  .tb-btn-primary {
    padding:9px 18px; background:#feb139; color:#25476a; border:none; border-radius:10px;
    font-size:13px; font-weight:700; font-family:Inter,sans-serif; cursor:pointer; white-space:nowrap;
  }
  .tb-btn-primary:hover:not(:disabled) { background:#f5a827; }
  .tb-btn-primary:disabled { background:#fde3b0; cursor:not-allowed; }
  .tb-btn-secondary {
    padding:9px 16px; background:#fff; color:#374151; border:1.5px solid #E5E7EB; border-radius:10px;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer; white-space:nowrap;
  }
  .tb-btn-secondary:hover { background:#F3F4F6; }

  .tb-body { display:grid; grid-template-columns:158px minmax(0,1fr); gap:18px; padding:0 24px 32px; max-width:100%; box-sizing:border-box; }
  @media(max-width:900px){ .tb-body{ grid-template-columns:1fr; } }
  .tb-body-content { min-width:0; }

  .tb-two-col { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:16px; align-items:start; }
  @media(max-width:1000px){ .tb-two-col{ grid-template-columns:1fr; } }

  .tb-rail { display:flex; flex-direction:column; gap:18px; }
  .tb-rail-section-title { font-size:10.5px; font-weight:800; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 8px 4px; }
  .tb-rail-link {
    display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:9px; font-size:13px;
    font-weight:600; color:#374151; text-decoration:none; cursor:pointer; background:none; border:none; width:100%; text-align:left;
  }
  .tb-rail-link:hover { background:#F3F4F6; }
  .tb-rail-link.active { background:#e8f5fb; color:#25476a; }
  .tb-rail-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }

  .tb-tabs { display:flex; gap:6px; margin-bottom:18px; border-bottom:2px solid #F3F4F6; }
  .tb-tab-btn {
    padding:9px 16px; background:none; border:none; border-bottom:2.5px solid transparent;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; color:#6B7280;
    cursor:pointer; margin-bottom:-2px; transition:color 0.15s, border-color 0.15s; white-space:nowrap;
  }
  .tb-tab-btn:hover  { color:#25476a; }
  .tb-tab-btn.active { color:#25476a; border-bottom-color:#25476a; }

  .tb-input, .tb-textarea, .tb-select {
    padding:10px 12px; border-radius:10px; border:1.5px solid #E5E7EB;
    font-size:13.5px; font-family:Inter,sans-serif; background:#F9FAFB;
    color:#374151; outline:none; width:100%; box-sizing:border-box;
  }
  .tb-input:focus, .tb-textarea:focus, .tb-select:focus { border-color:#38aae1; background:#fff; box-shadow:0 0 0 3px rgba(56,170,225,0.12); }
  .tb-label { font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:5px; }

  .tb-segmented { display:inline-flex; border:1.5px solid #E5E7EB; border-radius:10px; overflow:hidden; }
  .tb-segmented button {
    padding:8px 16px; background:#fff; border:none; font-size:12.5px; font-weight:700;
    font-family:Inter,sans-serif; color:#6B7280; cursor:pointer; border-left:1.5px solid #E5E7EB;
  }
  .tb-segmented button:first-child { border-left:none; }
  .tb-segmented button.active { background:#25476a; color:#fff; }

  .tb-workspace { display:grid; grid-template-columns:210px minmax(0,1fr) 270px; gap:14px; align-items:start; }
  @media(max-width:1360px){ .tb-workspace{ grid-template-columns:190px minmax(0,1fr) 250px; } }
  @media(max-width:1150px){ .tb-workspace{ grid-template-columns:1fr; } }

  .tb-card { background:#fff; border-radius:14px; border:1.5px solid #E5E7EB; padding:16px; min-width:0; box-sizing:border-box; }
  .tb-card-title { margin:0 0 10px; font-size:12.5px; font-weight:800; color:#0F2645; text-transform:uppercase; letter-spacing:0.04em; }

  .tb-palette-group { margin-bottom:14px; }
  .tb-palette-group-label { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 6px; }
  .tb-palette-btn {
    display:flex; align-items:center; gap:8px; width:100%; padding:9px 10px; margin-bottom:6px;
    border-radius:9px; border:1.5px solid #E5E7EB; background:#fff; font-size:12.5px; font-weight:600;
    color:#374151; cursor:pointer; text-align:left; transition:border-color 0.12s, background 0.12s;
  }
  .tb-palette-btn:hover { background:#F9FAFB; }
  .tb-palette-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

  .tb-section-block { border:1.5px solid #E5E7EB; border-radius:12px; margin-bottom:14px; overflow:hidden; }
  .tb-section-head {
    display:flex; align-items:center; gap:8px; padding:11px 14px; background:#F9FAFB; border-bottom:1px solid #F0F1F3;
  }
  .tb-section-title { flex:1; font-size:13px; font-weight:700; color:#111827; }
  .tb-section-body { padding:10px 14px; display:flex; flex-direction:column; gap:8px; }
  .tb-icon-btn {
    width:26px; height:26px; border-radius:7px; border:none; background:transparent; cursor:pointer;
    display:flex; align-items:center; justify-content:center; color:#9CA3AF; flex-shrink:0;
  }
  .tb-icon-btn:hover { background:#F3F4F6; color:#374151; }
  .tb-icon-btn.danger:hover { background:#FEF2F2; color:#DC2626; }

  .tb-entry-row {
    display:flex; align-items:center; flex-wrap:wrap; row-gap:6px; gap:8px 10px; padding:9px 10px; border-radius:9px; border:1.5px solid #EEF0F2;
    background:#FAFBFF; cursor:pointer; transition:border-color 0.12s; min-width:0;
  }
  .tb-entry-row:hover { border-color:#b8d9ee; }
  .tb-entry-row.selected { border-color:#25476a; background:#F0F7FF; }
  .tb-entry-num { font-size:12px; font-weight:700; color:#9CA3AF; width:16px; flex-shrink:0; }
  .tb-entry-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px; white-space:nowrap; flex-shrink:0; }
  .tb-entry-text { flex:1; min-width:0; font-size:12.5px; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tb-entry-points { font-size:11px; color:#9CA3AF; flex-shrink:0; }

  .tb-add-item-btn {
    display:flex; align-items:center; justify-content:center; gap:6px; width:100%; padding:9px;
    border-radius:9px; border:1.5px dashed #D1D5DB; background:transparent; color:#6B7280;
    font-size:12.5px; font-weight:600; cursor:pointer;
  }
  .tb-add-item-btn:hover { border-color:#25476a; color:#25476a; background:#F0F7FF; }

  .tb-placeholder { text-align:center; padding:28px 14px; color:#9CA3AF; }
  .tb-placeholder-icon {
    width:44px; height:44px; border-radius:12px; background:#F3F4F6; display:flex; align-items:center;
    justify-content:center; margin:0 auto 10px; color:#D1D5DB;
  }

  .tb-tag-chip {
    display:inline-flex; align-items:center; gap:6px; padding:4px 6px 4px 10px; border-radius:20px;
    font-size:12px; font-weight:700; font-family:Inter,sans-serif;
  }
  .tb-tag-chip-x {
    width:15px; height:15px; border-radius:50%; border:none; background:rgba(0,0,0,0.08); color:inherit;
    cursor:pointer; font-size:10px; font-weight:900; display:inline-flex; align-items:center; justify-content:center; padding:0; flex-shrink:0;
  }
  .tb-tag-dropdown {
    position:absolute; top:calc(100% + 6px); left:0; z-index:20; background:#fff; border:1px solid #E5E7EB;
    border-radius:12px; box-shadow:0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06);
    width:240px; max-height:260px; overflow-y:auto; padding:6px;
  }
  .tb-tag-dropdown-item {
    display:block; width:100%; padding:8px 10px; border:none; border-radius:8px; background:transparent;
    font-size:12.5px; font-weight:600; font-family:Inter,sans-serif; color:#374151; text-align:left; cursor:pointer;
  }
  .tb-tag-dropdown-item:hover { background:#F3F4F6; }
  .tb-tag-dropdown-item--material { display:flex; align-items:center; gap:8px; }

  .tb-material-row {
    display:flex; align-items:center; gap:10px; padding:9px 10px; border:1px solid #EEF0F2;
    border-radius:10px; background:#FAFBFF;
  }
  .tb-material-icon {
    width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
  }
  .tb-material-empty {
    display:flex; flex-direction:column; align-items:center; gap:8px; padding:22px 14px; margin-bottom:12px;
    border:1.5px dashed #E5E7EB; border-radius:12px; background:#FAFBFF;
  }
  .tb-material-empty-icon {
    width:36px; height:36px; border-radius:10px; background:#F3F4F6; color:#9CA3AF;
    display:flex; align-items:center; justify-content:center;
  }
  .tb-qty-stepper { display:flex; align-items:center; border:1.5px solid #E5E7EB; border-radius:9px; overflow:hidden; flex-shrink:0; }
  .tb-qty-btn {
    width:24px; height:28px; border:none; background:#F9FAFB; color:#374151; font-size:14px; font-weight:700;
    cursor:pointer; display:flex; align-items:center; justify-content:center; font-family:Inter,sans-serif;
  }
  .tb-qty-btn:hover:not(:disabled) { background:#F3F4F6; }
  .tb-qty-btn:disabled { color:#D1D5DB; cursor:not-allowed; }
  .tb-qty-input {
    width:36px; border:none; border-left:1.5px solid #E5E7EB; border-right:1.5px solid #E5E7EB; text-align:center;
    font-size:12.5px; font-family:Inter,sans-serif; color:#111827; outline:none; padding:5px 2px;
  }
  .tb-qty-input::-webkit-outer-spin-button, .tb-qty-input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
`;

/* ── small shared bits ─────────────────────────────────────────────────── */

function Label({ children }) {
  return <label className="tb-label">{children}</label>;
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="tb-segmented">
      {options.map((opt) => (
        <button key={opt} type="button" className={value === opt ? "active" : ""} onClick={() => onChange(opt)}>
          {STRUCTURE_MODE_LABELS[opt] || opt}
        </button>
      ))}
    </div>
  );
}

function ChipList({ values, options, labels, onToggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <button
            key={opt} type="button" onClick={() => onToggle(opt)}
            style={{
              padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer",
              border: `1.5px solid ${active ? "#25476a" : "#E5E7EB"}`, background: active ? "#e8f5fb" : "#fff",
              color: active ? "#25476a" : "#6B7280",
            }}
          >
            {active && "✓ "}{labels[opt] || opt}
          </button>
        );
      })}
    </div>
  );
}

/* ── Competency / Learning Area tag picker ──────────────────────────────── */

function TagPicker({ label, items, selectedIds, onChange, onCreateNew }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = selectedIds.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  const available = items.filter((i) => !selectedIds.includes(i.id));

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {selected.map((item, idx) => {
            const color = item.color || TAG_PALETTE[idx % TAG_PALETTE.length];
            return (
              <span key={item.id} className="tb-tag-chip" style={{ background: `${color}12`, border: `1.5px solid ${color}30`, color }}>
                {item.name}
                <button type="button" className="tb-tag-chip-x" onClick={() => onChange(selectedIds.filter((x) => x !== item.id))}>×</button>
              </span>
            );
          })}
        </div>
      )}
      <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
        <button type="button" className="tb-btn-secondary" onClick={() => setOpen((v) => !v)}>+ Add {label}</button>
        {open && (
          <div className="tb-tag-dropdown">
            {available.length === 0 && <div style={{ padding: "14px", textAlign: "center", fontSize: "12px", color: "#9CA3AF" }}>All {label.toLowerCase()}s already added.</div>}
            {available.map((item) => (
              <button key={item.id} type="button" className="tb-tag-dropdown-item" onClick={() => { onChange([...selectedIds, item.id]); setOpen(false); }}>{item.name}</button>
            ))}
            {onCreateNew && (
              <button
                type="button" className="tb-tag-dropdown-item"
                style={{ background: "#F0F7FF", color: "#25476a", fontWeight: 700, marginTop: available.length ? "4px" : 0 }}
                onClick={() => { onCreateNew(); setOpen(false); }}
              >
                + Create new {label.toLowerCase()}…
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Competency indicator picker (per question / criterion) ────────────── */

function IndicatorPicker({ options, selectedIds, onChange }) {
  if (!options || options.length === 0) {
    return <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>Attach a competency to this assessment (Info tab) to link indicators here.</p>;
  }
  return (
    <div>
      <Label>Competency Indicator(s)</Label>
      <TagPicker label="Indicator" items={options} selectedIds={selectedIds} onChange={onChange} />
    </div>
  );
}

/* ── entry factory ──────────────────────────────────────────────────────── */

function defaultEntry(kind, sectionId) {
  const base = { id: genId(), kind, sectionId, competencyIndicatorIds: [] };
  if (OBSERVATION_ITEM_KINDS.includes(kind)) {
    return { ...base, text: "", ratingScale: ["Not Yet", "Developing", "Proficient"] };
  }
  return {
    ...base,
    question: "", points: 1,
    options: kind === "mcqSingle" || kind === "mcqMultiple" ? ["", ""] : [],
    correctAnswer: "",
    pairs: kind === "matching" ? [{ left: "", right: "" }, { left: "", right: "" }] : [],
    blanks: kind === "fillBlank" ? [""] : [],
    sequence: kind === "ordering" ? ["", ""] : [],
    acceptedFileTypes: [],
    taskType: null,
    submissionKinds: [],
  };
}

function entryLabel(entry) {
  return entry.question ?? entry.text ?? "";
}

/* ── Item palette ───────────────────────────────────────────────────────── */

function ItemPalette({ type, structureType, onAdd }) {
  const groups = type === "observation"
    ? ["observation"]
    : structureType === "structured"
      ? (BUILDER_REGISTRY[type]?.itemGroups || []).filter((g) => g === "structured")
      : structureType === "unstructured"
        ? (BUILDER_REGISTRY[type]?.itemGroups || []).filter((g) => g === "unstructured" || g === "submission")
        : (BUILDER_REGISTRY[type]?.itemGroups || []);

  return (
    <div className="tb-card">
      <p className="tb-card-title">Add Item</p>
      <p style={{ margin: "-6px 0 12px", fontSize: "11px", color: "#9CA3AF" }}>Click to add an item to the focused section.</p>
      {groups.map((group) => (
        <div key={group} className="tb-palette-group">
          <p className="tb-palette-group-label" style={{ color: ITEM_GROUP_COLORS[group] }}>{ITEM_GROUP_LABELS[group]}</p>
          {ITEM_GROUPS[group].map((kind) => (
            <button key={kind} type="button" className="tb-palette-btn" onClick={() => onAdd(kind)}>
              <span className="tb-palette-dot" style={{ backgroundColor: ITEM_GROUP_COLORS[group] }} />
              {ITEM_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Structure canvas ───────────────────────────────────────────────────── */

function StructureCanvas({ type, sections, entries, focusedSectionId, selectedId, onFocusSection, onSelect, onAddSection, onRenameSection, onDeleteSection, onDeleteEntry, onMoveEntry, onMoveSection }) {
  let counter = 0;
  const color = TYPE_COLORS[type];

  return (
    <div className="tb-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <p className="tb-card-title" style={{ marginBottom: "2px" }}>Structure</p>
          <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF" }}>Organize the assessment using sections and add items.</p>
        </div>
        <button type="button" className="tb-btn-secondary" onClick={onAddSection}>+ Add Section</button>
      </div>

      {sections.length === 0 && entries.length === 0 && (
        <div className="tb-placeholder">
          <p style={{ margin: 0, fontSize: "13px" }}>No sections yet — add one, or just click an item in the palette to get started.</p>
        </div>
      )}

      {sections.map((section, sIdx) => {
        const sectionEntries = entries.filter((e) => e.sectionId === section.id);
        return (
          <div
            key={section.id} className="tb-section-block"
            style={{ borderColor: focusedSectionId === section.id ? color : "#E5E7EB" }}
            onClick={() => onFocusSection(section.id)}
          >
            <div className="tb-section-head">
              <button type="button" className="tb-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveSection(section.id, -1); }} disabled={sIdx === 0} title="Move up">↑</button>
              <button type="button" className="tb-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveSection(section.id, 1); }} disabled={sIdx === sections.length - 1} title="Move down">↓</button>
              <input
                className="tb-section-title" style={{ border: "none", background: "transparent", outline: "none", fontFamily: "Inter, sans-serif" }}
                value={section.name} onChange={(e) => onRenameSection(section.id, e.target.value)} onClick={(e) => e.stopPropagation()}
              />
              <button type="button" className="tb-icon-btn danger" onClick={(e) => { e.stopPropagation(); onDeleteSection(section.id); }} title="Delete section">✕</button>
            </div>
            <div className="tb-section-body">
              {sectionEntries.length === 0 && (
                <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No items in this section yet.</p>
              )}
              {sectionEntries.map((entry, eIdx) => {
                counter += 1;
                return renderEntryRow(entry, counter, eIdx, sectionEntries.length);
              })}
            </div>
          </div>
        );
      })}

      {(() => {
        const sectionIds = new Set(sections.map((s) => s.id));
        const orphanEntries = entries.filter((e) => !e.sectionId || !sectionIds.has(e.sectionId));
        if (orphanEntries.length === 0) return null;
        return (
          <div className="tb-section-block" style={{ borderColor: "#E5E7EB" }}>
            <div className="tb-section-head">
              <span className="tb-section-title" style={{ color: "#9CA3AF", fontStyle: "italic" }}>Unsectioned</span>
            </div>
            <div className="tb-section-body">
              {orphanEntries.map((entry, eIdx) => {
                counter += 1;
                return renderEntryRow(entry, counter, eIdx, orphanEntries.length);
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );

  function renderEntryRow(entry, num, eIdx, siblingCount) {
    const group = OBSERVATION_ITEM_KINDS.includes(entry.kind)
      ? "observation"
      : Object.entries(ITEM_GROUPS).find(([, kinds]) => kinds.includes(entry.kind))?.[0];
    const badgeColor = ITEM_GROUP_COLORS[group] || color;
    return (
      <div
        key={entry.id} className={`tb-entry-row${selectedId === entry.id ? " selected" : ""}`}
        onClick={(e) => { e.stopPropagation(); onSelect(entry.id); }}
      >
        <span className="tb-entry-num">{num}.</span>
        <span className="tb-entry-badge" style={{ color: badgeColor, backgroundColor: `${badgeColor}15`, border: `1px solid ${badgeColor}40` }}>
          {ITEM_KIND_LABELS[entry.kind]}
        </span>
        <span className="tb-entry-text">{stripHtml(entryLabel(entry)) || <em style={{ color: "#D1D5DB" }}>Untitled item</em>}</span>
        {!OBSERVATION_ITEM_KINDS.includes(entry.kind) && <span className="tb-entry-points">{entry.points} pt{entry.points !== 1 ? "s" : ""}</span>}
        <button type="button" className="tb-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveEntry(entry.id, -1); }} disabled={eIdx === 0} title="Move up">↑</button>
        <button type="button" className="tb-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveEntry(entry.id, 1); }} disabled={eIdx === siblingCount - 1} title="Move down">↓</button>
        <button type="button" className="tb-icon-btn danger" onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id); }} title="Delete">✕</button>
      </div>
    );
  }
}

/* ── Item configuration (right panel) ──────────────────────────────────── */

function ListEditor({ values, onChange, placeholder, minItems = 1, numbered = true }) {
  const set = (i, v) => { const next = [...values]; next[i] = v; onChange(next); };
  const add = () => onChange([...values, ""]);
  const remove = (i) => onChange(values.filter((_, idx) => idx !== i));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: "flex", gap: "6px" }}>
          <input className="tb-input" placeholder={numbered ? `${placeholder} ${i + 1}` : placeholder} value={v} onChange={(e) => set(i, e.target.value)} />
          {values.length > minItems && <button type="button" className="tb-icon-btn danger" onClick={() => remove(i)}>✕</button>}
        </div>
      ))}
      <button type="button" className="tb-add-item-btn" onClick={add}>+ Add</button>
    </div>
  );
}

function ItemConfigForm({ type, entry, onChange, indicatorOptions }) {
  const set = (key, val) => onChange({ ...entry, [key]: val });
  const isObservation = OBSERVATION_ITEM_KINDS.includes(entry.kind);
  const supportsTasks = BUILDER_REGISTRY[type]?.supportsTasks && !isObservation;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <Label>{isObservation ? "Observation Text" : "Question / Prompt"}</Label>
        <RichTextEditor value={entryLabel(entry)} onChange={(html) => set(isObservation ? "text" : "question", html)} minHeight={90} maxHeight={220} />
      </div>

      <IndicatorPicker
        options={indicatorOptions}
        selectedIds={entry.competencyIndicatorIds || []}
        onChange={(ids) => set("competencyIndicatorIds", ids)}
      />

      {!isObservation && (
        <div>
          <Label>Marks</Label>
          <input type="number" min="0" className="tb-input" value={entry.points} onChange={(e) => set("points", Number(e.target.value) || 0)} />
        </div>
      )}

      {(entry.kind === "mcqSingle" || entry.kind === "mcqMultiple") && (
        <div>
          <Label>Options</Label>
          <ListEditor values={entry.options} onChange={(v) => set("options", v)} placeholder="Option" minItems={2} />
        </div>
      )}

      {entry.kind === "trueFalse" && (
        <div>
          <Label>Correct Answer</Label>
          <div style={{ display: "flex", gap: "14px" }}>
            {["True", "False"].map((v) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#374151" }}>
                <input type="radio" name={`tf-${entry.id}`} checked={entry.correctAnswer === v} onChange={() => set("correctAnswer", v)} /> {v}
              </label>
            ))}
          </div>
        </div>
      )}

      {entry.kind === "matching" && (
        <div>
          <Label>Pairs</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {entry.pairs.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input className="tb-input" placeholder="Left" value={p.left} onChange={(e) => { const next = [...entry.pairs]; next[i] = { ...p, left: e.target.value }; set("pairs", next); }} />
                <span style={{ color: "#9CA3AF" }}>↔</span>
                <input className="tb-input" placeholder="Right" value={p.right} onChange={(e) => { const next = [...entry.pairs]; next[i] = { ...p, right: e.target.value }; set("pairs", next); }} />
                {entry.pairs.length > 2 && <button type="button" className="tb-icon-btn danger" onClick={() => set("pairs", entry.pairs.filter((_, idx) => idx !== i))}>✕</button>}
              </div>
            ))}
            <button type="button" className="tb-add-item-btn" onClick={() => set("pairs", [...entry.pairs, { left: "", right: "" }])}>+ Add Pair</button>
          </div>
        </div>
      )}

      {entry.kind === "fillBlank" && (
        <div>
          <Label>Blank Answers</Label>
          <ListEditor values={entry.blanks} onChange={(v) => set("blanks", v)} placeholder="Blank" minItems={1} />
        </div>
      )}

      {entry.kind === "ordering" && (
        <div>
          <Label>Steps (in correct order)</Label>
          <ListEditor values={entry.sequence} onChange={(v) => set("sequence", v)} placeholder="Step" minItems={2} />
        </div>
      )}

      {entry.kind === "shortAnswer" && (
        <div>
          <Label>Model Answer (optional)</Label>
          <input className="tb-input" value={entry.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} />
        </div>
      )}

      {["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload"].includes(entry.kind) && (
        <div>
          <Label>Accepted Formats (optional)</Label>
          <ListEditor values={entry.acceptedFileTypes.length ? entry.acceptedFileTypes : [""]} onChange={(v) => set("acceptedFileTypes", v.filter((x) => x.trim()))} placeholder="e.g. .pdf" minItems={0} numbered={false} />
        </div>
      )}

      {isObservation && entry.kind === "checklist" && (
        <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>A single checkbox item — no rating scale needed.</p>
      )}
      {isObservation && entry.kind === "note" && (
        <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>A freeform prompt — the teacher writes notes against it.</p>
      )}
      {isObservation && ["rating", "practicalSkill", "behaviour"].includes(entry.kind) && (
        <div>
          <Label>Rating Scale</Label>
          <ListEditor values={entry.ratingScale} onChange={(v) => set("ratingScale", v)} placeholder="Level" minItems={2} />
        </div>
      )}

      {supportsTasks && (
        <>
          <div>
            <Label>Task Type</Label>
            <select className="tb-select" value={entry.taskType || ""} onChange={(e) => set("taskType", e.target.value || null)}>
              <option value="">— None —</option>
              {TASK_TYPES.map((t) => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <Label>Submission Type(s)</Label>
            <ChipList
              values={entry.submissionKinds} options={SUBMISSION_ITEM_KINDS} labels={ITEM_KIND_LABELS}
              onToggle={(kind) => set("submissionKinds", entry.submissionKinds.includes(kind) ? entry.submissionKinds.filter((k) => k !== kind) : [...entry.submissionKinds, kind])}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ── Right panel ────────────────────────────────────────────────────────── */

function PlaceholderPanel({ text }) {
  return (
    <div className="tb-placeholder" style={{ padding: "20px 10px" }}>
      <div className="tb-placeholder-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 12h6M9 16h6M9 8h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" /></svg>
      </div>
      <p style={{ margin: 0, fontSize: "12px" }}>{text}</p>
    </div>
  );
}

function SummaryCard({ form }) {
  return (
    <div className="tb-card">
      <p className="tb-card-title">Assessment Information</p>
      <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: 700, color: "#111827", wordBreak: "break-word" }}>{form.name || <em style={{ color: "#D1D5DB", fontWeight: 400 }}>Untitled assessment</em>}</p>
      <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF" }}>{TYPE_LABELS[form.type]} · {STRUCTURE_MODE_LABELS[form.structureType]}</p>
    </div>
  );
}

function RightPanel({ form, selectedEntry, onUpdateEntry, indicatorOptions }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SummaryCard form={form} />

      <div className="tb-card">
        <p className="tb-card-title">Item Configuration</p>
        {selectedEntry ? (
          <ItemConfigForm type={form.type} entry={selectedEntry} onChange={onUpdateEntry} indicatorOptions={indicatorOptions} />
        ) : (
          <PlaceholderPanel text="Select an item from the builder to configure its properties." />
        )}
      </div>
    </div>
  );
}

/* ── Grading Rubric tab (Assignment/Project) ────────────────────────────── */

function GradingRubricTab({ rubric, onChange, indicatorOptions }) {
  const add = () => onChange([...rubric, { id: genId(), criterion: "", description: "", points: 10, competencyIndicatorIds: [] }]);
  const update = (id, patch) => onChange(rubric.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id) => onChange(rubric.filter((c) => c.id !== id));
  const totalPoints = rubric.reduce((sum, c) => sum + (Number(c.points) || 0), 0);

  return (
    <div className="tb-card">
      <p className="tb-card-title">Grading Rubric{rubric.length ? ` · ${totalPoints} pts` : ""}</p>
      <p style={{ margin: "-4px 0 12px", fontSize: "11.5px", color: "#9CA3AF" }}>Optional holistic grading criteria, separate from the item-level marks above.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {rubric.map((c) => (
          <div key={c.id} style={{ padding: "10px 12px", border: "1px solid #EEF0F2", borderRadius: "10px", background: "#FAFBFF" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
              <input className="tb-input" placeholder="Criterion" value={c.criterion} onChange={(e) => update(c.id, { criterion: e.target.value })} />
              <input type="number" min="0" className="tb-input" style={{ width: "90px", flexShrink: 0 }} placeholder="Points" value={c.points} onChange={(e) => update(c.id, { points: Number(e.target.value) || 0 })} />
              <button type="button" className="tb-icon-btn danger" onClick={() => remove(c.id)}>✕</button>
            </div>
            <textarea className="tb-textarea" rows={2} placeholder="Description (optional)" value={c.description} onChange={(e) => update(c.id, { description: e.target.value })} />
            <div style={{ marginTop: "8px" }}>
              <IndicatorPicker
                options={indicatorOptions}
                selectedIds={c.competencyIndicatorIds || []}
                onChange={(ids) => update(c.id, { competencyIndicatorIds: ids })}
              />
            </div>
          </div>
        ))}
        <button type="button" className="tb-add-item-btn" onClick={add}>+ Add Criterion</button>
      </div>
    </div>
  );
}

/* ── Deliverables & Milestones tab (Project only) ──────────────────────── */

function DeliverablesMilestonesTab({ deliverables, milestones, onChangeDeliverables, onChangeMilestones }) {
  const addDeliverable = () => onChangeDeliverables([...deliverables, { id: genId(), name: "", description: "", submissionKinds: [] }]);
  const updateDeliverable = (id, patch) => onChangeDeliverables(deliverables.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const removeDeliverable = (id) => onChangeDeliverables(deliverables.filter((d) => d.id !== id));

  const addMilestone = () => onChangeMilestones([...milestones, { id: genId(), name: "", description: "", order: milestones.length }]);
  const updateMilestone = (id, patch) => onChangeMilestones(milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMilestone = (id) => onChangeMilestones(milestones.filter((m) => m.id !== id));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      <div className="tb-card">
        <p className="tb-card-title">Deliverables</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {deliverables.map((d) => (
            <div key={d.id} style={{ padding: "10px 12px", border: "1px solid #EEF0F2", borderRadius: "10px", background: "#FAFBFF" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                <input className="tb-input" placeholder="Deliverable name" value={d.name} onChange={(e) => updateDeliverable(d.id, { name: e.target.value })} />
                <button type="button" className="tb-icon-btn danger" onClick={() => removeDeliverable(d.id)}>✕</button>
              </div>
              <textarea className="tb-textarea" rows={2} placeholder="Description (optional)" value={d.description} onChange={(e) => updateDeliverable(d.id, { description: e.target.value })} style={{ marginBottom: "6px" }} />
              <ChipList values={d.submissionKinds} options={SUBMISSION_ITEM_KINDS} labels={ITEM_KIND_LABELS} onToggle={(kind) => updateDeliverable(d.id, { submissionKinds: d.submissionKinds.includes(kind) ? d.submissionKinds.filter((k) => k !== kind) : [...d.submissionKinds, kind] })} />
            </div>
          ))}
          <button type="button" className="tb-add-item-btn" onClick={addDeliverable}>+ Add Deliverable</button>
        </div>
      </div>

      <div className="tb-card">
        <p className="tb-card-title">Milestones <span style={{ fontWeight: 400, color: "#9CA3AF", textTransform: "none" }}>(optional)</span></p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {milestones.map((m) => (
            <div key={m.id} style={{ padding: "10px 12px", border: "1px solid #EEF0F2", borderRadius: "10px", background: "#FAFBFF" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                <input className="tb-input" placeholder="Milestone name" value={m.name} onChange={(e) => updateMilestone(m.id, { name: e.target.value })} />
                <button type="button" className="tb-icon-btn danger" onClick={() => removeMilestone(m.id)}>✕</button>
              </div>
              <textarea className="tb-textarea" rows={2} placeholder="Description (optional)" value={m.description} onChange={(e) => updateMilestone(m.id, { description: e.target.value })} />
            </div>
          ))}
          <button type="button" className="tb-add-item-btn" onClick={addMilestone}>+ Add Milestone</button>
        </div>
      </div>
    </div>
  );
}

/* ── Inventory tab (Project only) ───────────────────────────────────────── */

function InventoryTab({ inventory, catalog, onChange, onCreateNew }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const linkedIds = inventory.map((l) => l.itemId);
  const available = catalog.filter((i) => !linkedIds.includes(i.id));
  const q = query.trim().toLowerCase();
  const filtered = q ? available.filter((i) => i.name.toLowerCase().includes(q)) : available;

  const add = (itemId) => { onChange([...inventory, { itemId, quantity: 1 }]); setOpen(false); setQuery(""); };
  const setQuantity = (itemId, quantity) => onChange(inventory.map((l) => (l.itemId === itemId ? { ...l, quantity: Math.max(1, quantity) } : l)));
  const step = (itemId, delta) => {
    const link = inventory.find((l) => l.itemId === itemId);
    if (link) setQuantity(itemId, link.quantity + delta);
  };
  const remove = (itemId) => onChange(inventory.filter((l) => l.itemId !== itemId));

  return (
    <div className="tb-card">
      <p className="tb-card-title" style={{ marginBottom: "2px" }}>Materials{inventory.length ? ` · ${inventory.length}` : ""}</p>
      <p style={{ margin: "0 0 14px", fontSize: "11.5px", color: "#9CA3AF" }}>
        Robots, boards, sensors, and other materials this project needs — pulled from the shared Settings catalog.
      </p>

      {inventory.length === 0 && (
        <div className="tb-material-empty">
          <span className="tb-material-empty-icon"><FiPackage size={18} /></span>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>No materials added yet.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
        {inventory.map((link) => {
          const item = catalog.find((i) => i.id === link.itemId);
          if (!item) return null;
          const color = INVENTORY_CATEGORY_COLORS[item.category] || INVENTORY_CATEGORY_COLORS.Other;
          const Icon = INVENTORY_CATEGORY_ICONS[item.category] || INVENTORY_CATEGORY_ICONS.Other;
          return (
            <div key={link.itemId} className="tb-material-row">
              <span className="tb-material-icon" style={{ backgroundColor: `${color}15`, color }}>
                <Icon size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </p>
                <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{item.category}</span>
              </div>
              <div className="tb-qty-stepper">
                <button type="button" className="tb-qty-btn" onClick={() => step(link.itemId, -1)} disabled={link.quantity <= 1}>−</button>
                <input
                  type="number" min="1" className="tb-qty-input"
                  value={link.quantity} onChange={(e) => setQuantity(link.itemId, Number(e.target.value) || 1)}
                />
                <button type="button" className="tb-qty-btn" onClick={() => step(link.itemId, 1)}>+</button>
              </div>
              <span style={{ fontSize: "11px", color: "#9CA3AF", width: "30px", flexShrink: 0 }}>{item.unit}</span>
              <button type="button" className="tb-icon-btn danger" onClick={() => remove(link.itemId)}><FiX size={14} /></button>
            </div>
          );
        })}
      </div>

      <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
        <button type="button" className="tb-btn-secondary" onClick={() => setOpen((v) => !v)}>
          <FiPlus size={13} style={{ marginRight: "5px", verticalAlign: "-2px" }} />Add Material
        </button>
        {open && (
          <div className="tb-tag-dropdown" style={{ width: "270px" }}>
            <div style={{ padding: "4px 4px 8px" }}>
              <input
                autoFocus className="tb-input" style={{ padding: "7px 10px", fontSize: "12.5px" }}
                placeholder="Search catalog…" value={query} onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: "14px", textAlign: "center", fontSize: "12px", color: "#9CA3AF" }}>
                {available.length === 0 ? "All catalog items already added." : "No matches."}
              </div>
            )}
            {filtered.map((item) => {
              const color = INVENTORY_CATEGORY_COLORS[item.category] || INVENTORY_CATEGORY_COLORS.Other;
              const Icon = INVENTORY_CATEGORY_ICONS[item.category] || INVENTORY_CATEGORY_ICONS.Other;
              return (
                <button key={item.id} type="button" className="tb-tag-dropdown-item tb-tag-dropdown-item--material" onClick={() => add(item.id)}>
                  <span className="tb-material-icon" style={{ width: "24px", height: "24px", backgroundColor: `${color}15`, color }}>
                    <Icon size={12} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                  <span style={{ color: "#9CA3AF", fontSize: "11px", flexShrink: 0 }}>{item.category}</span>
                </button>
              );
            })}
            <button
              type="button" className="tb-tag-dropdown-item"
              style={{ background: "#F0F7FF", color: "#25476a", fontWeight: 700, marginTop: "4px" }}
              onClick={() => { onCreateNew(); setOpen(false); setQuery(""); }}
            >
              + Create new item…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Preview modal ──────────────────────────────────────────────────────── */

function PreviewModal({ form, entries, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "620px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff" }}>{form.name || "Untitled assessment"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{TYPE_LABELS[form.type]} · {STRUCTURE_MODE_LABELS[form.structureType]}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px", width: "26px", height: "26px", borderRadius: "8px" }}>×</button>
        </div>
        <div style={{ padding: "20px 22px", maxHeight: "60vh", overflowY: "auto" }}>
          {!isEmptyHtml(form.description) && <div style={{ margin: "0 0 14px" }}><RichContent html={form.description} /></div>}
          {form.sections.map((section) => (
            <div key={section.id} style={{ marginBottom: "14px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 700, color: "#25476a" }}>{section.name}</p>
              {entries.filter((e) => e.sectionId === section.id).map((entry) => (
                <div key={entry.id} style={{ padding: "8px 10px", fontSize: "12.5px", color: "#374151", background: "#F9FAFB", borderRadius: "8px", marginBottom: "5px" }}>
                  {stripHtml(entryLabel(entry)) || <em style={{ color: "#D1D5DB" }}>Untitled item</em>} <span style={{ color: "#9CA3AF" }}>· {ITEM_KIND_LABELS[entry.kind]}</span>
                </div>
              ))}
            </div>
          ))}
          {entries.filter((e) => !e.sectionId).length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 700, color: "#9CA3AF" }}>Unsectioned</p>
              {entries.filter((e) => !e.sectionId).map((entry) => (
                <div key={entry.id} style={{ padding: "8px 10px", fontSize: "12.5px", color: "#374151", background: "#F9FAFB", borderRadius: "8px", marginBottom: "5px" }}>
                  {stripHtml(entryLabel(entry)) || <em style={{ color: "#D1D5DB" }}>Untitled item</em>} <span style={{ color: "#9CA3AF" }}>· {ITEM_KIND_LABELS[entry.kind]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── form (de)serialization ─────────────────────────────────────────────── */

function buildBlankForm(type) {
  return {
    type, name: "", description: "", instructions: "", structureType: "mixed", overview: "",
    sections: [], items: [], indicators: [], deliverables: [], milestones: [], rubric: [],
    competencyIds: [], learningAreaIds: [], inventory: [],
  };
}

function buildFormFromAssessment(a, competencyIds, learningAreaIds, inventory) {
  return {
    type: a.type, name: a.name || "", description: a.description || "", instructions: a.instructions || "",
    structureType: a.structureType || "mixed", overview: a.overview || "",
    sections: a.sections || [],
    items: (a.items || []).map((item) => ({ ...normalizeLegacyItem(item), id: item.id || genId(), competencyIndicatorIds: item.competencyIndicatorIds || [] })),
    indicators: (a.indicators || []).map((ind) => ({ id: ind.id || genId(), kind: ind.kind || "rating", sectionId: ind.sectionId || null, competencyIndicatorIds: ind.competencyIndicatorIds || [], ...ind })),
    deliverables: (a.deliverables || []).map((d) => ({ ...d, id: d.id || genId() })),
    milestones: (a.milestones || []).map((m) => ({ ...m, id: m.id || genId() })),
    rubric: (a.rubric || []).map((c) => ({ ...c, id: c.id || genId(), competencyIndicatorIds: c.competencyIndicatorIds || [] })),
    competencyIds, learningAreaIds, inventory,
  };
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function AssessmentBuilderPage() {
  const { type: routeType, id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: assessment, isLoading: loadingAssessment } = useAssessmentQuery(id);
  const { data: linkedCompetencies, isLoading: loadingCompetencies } = useAssessmentCompetencies(id);
  const { data: linkedLearningAreas, isLoading: loadingLearningAreas } = useAssessmentLearningAreas(id);
  const { data: linkedInventory, isLoading: loadingInventory } = useAssessmentInventory(id);
  const { mutate: createAssessment, isPending: creating } = useCreateAssessment();
  const { mutate: updateAssessment, isPending: updating } = useUpdateAssessment();
  const { data: allCompetencies = [] } = useCompetencies();
  const { data: allLearningAreas = [] } = useLearningAreas();
  const { data: allInventory = [] } = useInventory();

  const [form, setForm] = useState(null);
  const [originalTags, setOriginalTags] = useState({ competencyIds: [], learningAreaIds: [], inventory: [] });
  const [activeTab, setActiveTab] = useState("info");
  const [focusedSectionId, setFocusedSectionId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createCompetencyOpen, setCreateCompetencyOpen] = useState(false);
  const [createLearningAreaOpen, setCreateLearningAreaOpen] = useState(false);
  const [createInventoryOpen, setCreateInventoryOpen] = useState(false);

  const indicatorOptions = useMemo(() => {
    if (!form) return [];
    return allCompetencies
      .filter((comp) => form.competencyIds.includes(comp.id))
      .flatMap((comp) => (comp.indicators || []).map((ind) => ({ id: ind.id, name: `${comp.name} — ${ind.name}` })));
  }, [allCompetencies, form]);

  useEffect(() => {
    if (form) return;
    if (isEdit) {
      if (loadingAssessment || loadingCompetencies || loadingLearningAreas || loadingInventory || !assessment) return;
      const competencyIds = linkedCompetencies.map((c) => c.id);
      const learningAreaIds = linkedLearningAreas.map((a) => a.id);
      const inventory = linkedInventory.map((i) => ({ itemId: i.id, quantity: i.quantity }));
      setForm(buildFormFromAssessment(assessment, competencyIds, learningAreaIds, inventory));
      setOriginalTags({ competencyIds, learningAreaIds, inventory });
    } else {
      setForm(buildBlankForm(routeType));
    }
  }, [form, isEdit, loadingAssessment, loadingCompetencies, loadingLearningAreas, loadingInventory, assessment, linkedCompetencies, linkedLearningAreas, linkedInventory, routeType]);

  useEffect(() => { document.title = "Assessment Builder"; }, []);

  useEffect(() => {
    const el = document.createElement("style");
    el.id = "ab-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("ab-styles")?.remove(); };
  }, []);

  if (!form) {
    return <div style={{ padding: "60px", textAlign: "center", color: "#9CA3AF" }}>Loading…</div>;
  }

  const type = form.type;
  const isObservation = type === "observation";
  const entries = isObservation ? form.indicators : form.items;
  const setEntries = (updater) => {
    const key = isObservation ? "indicators" : "items";
    setForm((f) => ({ ...f, [key]: typeof updater === "function" ? updater(f[key]) : updater }));
  };
  const selectedEntry = entries.find((e) => e.id === selectedId) || null;

  function addSection() {
    const section = { id: genId(), name: `Section ${form.sections.length + 1}`, order: form.sections.length };
    setForm((f) => ({ ...f, sections: [...f.sections, section] }));
    setFocusedSectionId(section.id);
  }
  function renameSection(sectionId, name) {
    setForm((f) => ({ ...f, sections: f.sections.map((s) => (s.id === sectionId ? { ...s, name } : s)) }));
  }
  function deleteSection(sectionId) {
    setForm((f) => ({ ...f, sections: f.sections.filter((s) => s.id !== sectionId) }));
    setEntries((prev) => prev.map((e) => (e.sectionId === sectionId ? { ...e, sectionId: null } : e)));
    if (focusedSectionId === sectionId) setFocusedSectionId(null);
  }
  function moveSection(sectionId, dir) {
    setForm((f) => {
      const idx = f.sections.findIndex((s) => s.id === sectionId);
      const to = idx + dir;
      if (to < 0 || to >= f.sections.length) return f;
      const next = [...f.sections];
      [next[idx], next[to]] = [next[to], next[idx]];
      return { ...f, sections: next.map((s, i) => ({ ...s, order: i })) };
    });
  }

  function addEntry(kind) {
    let sectionId = focusedSectionId;
    if (!sectionId) {
      if (form.sections.length === 0) {
        const section = { id: genId(), name: "Section 1", order: 0 };
        setForm((f) => ({ ...f, sections: [section] }));
        sectionId = section.id;
      } else {
        sectionId = form.sections[0].id;
      }
      setFocusedSectionId(sectionId);
    }
    const entry = defaultEntry(kind, sectionId);
    setEntries((prev) => [...prev, entry]);
    setSelectedId(entry.id);
    setActiveTab("structure");
  }
  function updateEntry(updated) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }
  function deleteEntry(entryId) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (selectedId === entryId) setSelectedId(null);
  }
  function moveEntry(entryId, dir) {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === entryId);
      const siblings = prev.filter((e) => e.sectionId === entry.sectionId);
      const idx = siblings.findIndex((e) => e.id === entryId);
      const to = idx + dir;
      if (to < 0 || to >= siblings.length) return prev;
      const other = siblings[to];
      const posA = prev.findIndex((e) => e.id === entry.id);
      const posB = prev.findIndex((e) => e.id === other.id);
      const next = [...prev];
      [next[posA], next[posB]] = [next[posB], next[posA]];
      return next;
    });
  }

  function buildPayload() {
    const registry = BUILDER_REGISTRY[type];
    const payload = {
      name: form.name.trim(), type, description: form.description.trim(), instructions: form.instructions.trim(),
      structureType: form.structureType,
      sections: form.sections.map((s, i) => ({ ...s, order: i })),
    };
    if (registry?.supportsDeliverables) payload.overview = form.overview.trim();
    payload.items = isObservation || registry?.supportsItems === false ? [] : form.items;
    payload.indicators = isObservation ? form.indicators : [];
    payload.rubric = registry?.supportsRubric ? form.rubric : [];
    if (registry?.supportsDeliverables) payload.deliverables = form.deliverables;
    if (registry?.supportsMilestones) payload.milestones = form.milestones;
    return payload;
  }

  async function reconcileTags(assessmentId) {
    const { competencyIds, learningAreaIds, inventory } = form;
    if (isEdit) {
      const compToAdd = competencyIds.filter((cid) => !originalTags.competencyIds.includes(cid));
      const compToRemove = originalTags.competencyIds.filter((cid) => !competencyIds.includes(cid));
      const areaToAdd = learningAreaIds.filter((aid) => !originalTags.learningAreaIds.includes(aid));
      const areaToRemove = originalTags.learningAreaIds.filter((aid) => !learningAreaIds.includes(aid));
      const invIds = inventory.map((l) => l.itemId);
      const origInvIds = originalTags.inventory.map((l) => l.itemId);
      const invToRemove = origInvIds.filter((iid) => !invIds.includes(iid));
      const invToUpsert = inventory.filter((l) => {
        const original = originalTags.inventory.find((o) => o.itemId === l.itemId);
        return !original || original.quantity !== l.quantity;
      });
      await Promise.all([
        ...compToAdd.map((cid) => assessmentApi.linkCompetency(assessmentId, cid)),
        ...compToRemove.map((cid) => assessmentApi.unlinkCompetency(assessmentId, cid)),
        ...areaToAdd.map((aid) => assessmentApi.linkLearningArea(assessmentId, aid)),
        ...areaToRemove.map((aid) => assessmentApi.unlinkLearningArea(assessmentId, aid)),
        ...invToUpsert.map((l) => assessmentApi.linkInventoryItem(assessmentId, l.itemId, l.quantity)),
        ...invToRemove.map((iid) => assessmentApi.unlinkInventoryItem(assessmentId, iid)),
      ]);
    } else {
      await Promise.all([
        ...competencyIds.map((cid) => assessmentApi.linkCompetency(assessmentId, cid)),
        ...learningAreaIds.map((aid) => assessmentApi.linkLearningArea(assessmentId, aid)),
        ...inventory.map((l) => assessmentApi.linkInventoryItem(assessmentId, l.itemId, l.quantity)),
      ]);
    }
  }

  function handleSave() {
    if (!form.name.trim()) { setActiveTab("info"); return; }
    const data = buildPayload();
    if (isEdit) {
      updateAssessment({ id, data }, { onSuccess: async () => { await reconcileTags(id); navigate(`/assessments/${id}/view`); } });
    } else {
      createAssessment(data, { onSuccess: async (created) => { await reconcileTags(created.id); navigate(`/assessments/${created.id}/view`); } });
    }
  }

  const isPending = creating || updating;
  const color = TYPE_COLORS[type];
  const tabs = [
    { key: "info", label: "Assessment Information" },
    ...(BUILDER_REGISTRY[type]?.supportsItems !== false ? [{ key: "structure", label: "Structure & Items" }] : []),
    ...(BUILDER_REGISTRY[type]?.supportsRubric ? [{ key: "rubric", label: "Grading Rubric" }] : []),
    ...(BUILDER_REGISTRY[type]?.supportsDeliverables ? [{ key: "deliverables", label: "Deliverables & Milestones" }] : []),
    ...(BUILDER_REGISTRY[type]?.supportsInventory ? [{ key: "inventory", label: "Inventory" }] : []),
  ];

  return (
    <div className="tb-page">
      <div className="tb-header">
        <div>
          <p className="tb-crumb"><a onClick={() => navigate("/assessments")}>Assessments</a> / {isEdit ? "Edit Assessment" : "Create New Assessment"}</p>
          <div className="tb-title-row">
            <div className="tb-title-icon" style={{ backgroundColor: `${color}15`, color }}>{TYPE_ICONS[type]}</div>
            <div className="tb-title-text">
              <h1 className="tb-title">{TYPE_LABELS[type]} Assessment</h1>
              <p className="tb-subtitle">Build a {TYPE_LABELS[type].toLowerCase()} assessment. Add sections and items of any type.</p>
            </div>
          </div>
        </div>
        <div className="tb-actions">
          <button type="button" className="tb-btn-secondary" onClick={() => setPreviewOpen(true)}>Preview Assessment</button>
          <button type="button" className="tb-btn-primary" onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : "Save Assessment"}</button>
        </div>
      </div>

      <div className="tb-body">
        <div className="tb-rail">
          <div>
            <p className="tb-rail-section-title">New Assessment</p>
            {Object.keys(TYPE_LABELS).filter((t) => t !== "exam").map((t) => (
              <button key={t} type="button" className={`tb-rail-link${t === type && !isEdit ? " active" : ""}`} onClick={() => navigate(`/assessments/new/${t}`)}>
                <span className="tb-rail-dot" style={{ backgroundColor: TYPE_COLORS[t] }} /> {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="tb-body-content">
          <div className="tb-tabs">
            {tabs.map((tab) => (
              <button key={tab.key} type="button" className={`tb-tab-btn${activeTab === tab.key ? " active" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
            ))}
          </div>

          {activeTab === "info" && (
            <div className="tb-two-col">
              <div className="tb-card">
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <Label>Assessment Name *</Label>
                    <input className="tb-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Mid-term Mathematics Exam" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <RichTextEditor value={form.description} onChange={(html) => setForm((f) => ({ ...f, description: html }))} />
                  </div>
                  <div>
                    <Label>Default Instructions</Label>
                    <RichTextEditor value={form.instructions} onChange={(html) => setForm((f) => ({ ...f, instructions: html }))} />
                  </div>
                  {BUILDER_REGISTRY[type]?.supportsDeliverables && (
                    <div>
                      <Label>Project Overview</Label>
                      <RichTextEditor value={form.overview} onChange={(html) => setForm((f) => ({ ...f, overview: html }))} />
                    </div>
                  )}
                  <div>
                    <Label>Structure Type</Label>
                    <SegmentedControl options={STRUCTURE_MODES} value={form.structureType} onChange={(v) => setForm((f) => ({ ...f, structureType: v }))} />
                  </div>
                  <div>
                    <Label>Competencies</Label>
                    <TagPicker
                      label="Competency" items={allCompetencies} selectedIds={form.competencyIds}
                      onChange={(ids) => setForm((f) => ({ ...f, competencyIds: ids }))}
                      onCreateNew={() => setCreateCompetencyOpen(true)}
                    />
                  </div>
                  <div>
                    <Label>Learning Areas</Label>
                    <TagPicker
                      label="Learning Area" items={allLearningAreas} selectedIds={form.learningAreaIds}
                      onChange={(ids) => setForm((f) => ({ ...f, learningAreaIds: ids }))}
                      onCreateNew={() => setCreateLearningAreaOpen(true)}
                    />
                  </div>
                </div>
              </div>
              <SummaryCard form={form} />
            </div>
          )}

          {activeTab === "structure" && (
            <div className="tb-workspace">
              <ItemPalette type={type} structureType={form.structureType} onAdd={addEntry} />
              <StructureCanvas
                type={type} sections={form.sections} entries={entries}
                focusedSectionId={focusedSectionId} selectedId={selectedId}
                onFocusSection={setFocusedSectionId} onSelect={setSelectedId}
                onAddSection={addSection} onRenameSection={renameSection} onDeleteSection={deleteSection}
                onDeleteEntry={deleteEntry} onMoveEntry={moveEntry} onMoveSection={moveSection}
              />
              <RightPanel form={form} selectedEntry={selectedEntry} onUpdateEntry={updateEntry} indicatorOptions={indicatorOptions} />
            </div>
          )}

          {activeTab === "rubric" && (
            <div className="tb-two-col">
              <GradingRubricTab rubric={form.rubric} onChange={(v) => setForm((f) => ({ ...f, rubric: v }))} indicatorOptions={indicatorOptions} />
              <SummaryCard form={form} />
            </div>
          )}

          {activeTab === "deliverables" && (
            <DeliverablesMilestonesTab
              deliverables={form.deliverables} milestones={form.milestones}
              onChangeDeliverables={(v) => setForm((f) => ({ ...f, deliverables: v }))}
              onChangeMilestones={(v) => setForm((f) => ({ ...f, milestones: v }))}
            />
          )}

          {activeTab === "inventory" && (
            <InventoryTab
              inventory={form.inventory} catalog={allInventory}
              onChange={(v) => setForm((f) => ({ ...f, inventory: v }))}
              onCreateNew={() => setCreateInventoryOpen(true)}
            />
          )}
        </div>
      </div>

      {previewOpen && <PreviewModal form={form} entries={entries} onClose={() => setPreviewOpen(false)} />}
      {createCompetencyOpen && (
        <CreateCompetencyModal
          onClose={() => setCreateCompetencyOpen(false)}
          onCreated={(id) => setForm((f) => ({ ...f, competencyIds: [...f.competencyIds, id] }))}
        />
      )}
      {createLearningAreaOpen && (
        <CreateLearningAreaModal
          onClose={() => setCreateLearningAreaOpen(false)}
          onCreated={(id) => setForm((f) => ({ ...f, learningAreaIds: [...f.learningAreaIds, id] }))}
        />
      )}
      {createInventoryOpen && (
        <CreateInventoryItemModal
          onClose={() => setCreateInventoryOpen(false)}
          onCreated={(itemId) => setForm((f) => ({ ...f, inventory: [...f.inventory, { itemId, quantity: 1 }] }))}
        />
      )}
    </div>
  );
}
