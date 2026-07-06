import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTemplates, useCreateTemplate, useUpdateTemplate } from "../hooks/useTemplates";
import {
  STRUCTURE_MODES, STRUCTURE_MODE_LABELS, ITEM_GROUPS, ITEM_GROUP_LABELS, ITEM_GROUP_COLORS,
  ITEM_KIND_LABELS, OBSERVATION_ITEM_KINDS, TASK_TYPES, TASK_TYPE_LABELS, SUBMISSION_ITEM_KINDS,
  BUILDER_REGISTRY, normalizeLegacyItem,
} from "../schemas/templateBuilder.schema";

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", assignment: "Assignment", project: "Project", observation: "Teacher Observation" };
const TYPE_COLORS = { quiz: "#25476a", exam: "#38aae1", project: "#7C3AED", assignment: "#059669", observation: "#D97706" };
const TYPE_ICONS = { quiz: "📝", exam: "🎓", project: "🛠️", assignment: "📄", observation: "👁️" };

function genId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
}

/* ── CSS ────────────────────────────────────────────────────────────────── */

const CSS = `
  .tb-page { font-family: Inter, sans-serif; }
  .tb-header {
    display:flex; align-items:center; justify-content:space-between; gap:16px;
    padding:18px 24px; background:#fff; border-bottom:1.5px solid #E5E7EB; margin-bottom:18px;
  }
  .tb-crumb { font-size:12px; color:#9CA3AF; margin-bottom:4px; }
  .tb-crumb a { color:#38aae1; text-decoration:none; cursor:pointer; }
  .tb-title-row { display:flex; align-items:center; gap:12px; }
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

  .tb-body { display:grid; grid-template-columns:200px 1fr; gap:20px; padding:0 24px 32px; }
  @media(max-width:900px){ .tb-body{ grid-template-columns:1fr; } }

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

  .tb-workspace { display:grid; grid-template-columns:230px 1fr 300px; gap:16px; align-items:start; }
  @media(max-width:1200px){ .tb-workspace{ grid-template-columns:1fr; } }

  .tb-card { background:#fff; border-radius:14px; border:1.5px solid #E5E7EB; padding:16px; }
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
    display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:9px; border:1.5px solid #EEF0F2;
    background:#FAFBFF; cursor:pointer; transition:border-color 0.12s;
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

/* ── entry factory ──────────────────────────────────────────────────────── */

function defaultEntry(kind, sectionId) {
  const base = { id: genId(), kind, sectionId };
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
        <span className="tb-entry-text">{entryLabel(entry) || <em style={{ color: "#D1D5DB" }}>Untitled item</em>}</span>
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

function ItemConfigForm({ type, entry, onChange }) {
  const set = (key, val) => onChange({ ...entry, [key]: val });
  const isObservation = OBSERVATION_ITEM_KINDS.includes(entry.kind);
  const supportsTasks = BUILDER_REGISTRY[type]?.supportsTasks && !isObservation;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <Label>{isObservation ? "Observation Text" : "Question / Prompt"}</Label>
        <textarea className="tb-textarea" rows={3} value={entryLabel(entry)} onChange={(e) => set(isObservation ? "text" : "question", e.target.value)} />
      </div>

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

function RightPanel({ form, selectedEntry, onUpdateEntry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="tb-card">
        <p className="tb-card-title">Template Information</p>
        <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: 700, color: "#111827" }}>{form.name || <em style={{ color: "#D1D5DB", fontWeight: 400 }}>Untitled template</em>}</p>
        <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF" }}>{TYPE_LABELS[form.type]} · {STRUCTURE_MODE_LABELS[form.structureType]}</p>
      </div>

      <div className="tb-card">
        <p className="tb-card-title">Item Configuration</p>
        {selectedEntry ? (
          <ItemConfigForm type={form.type} entry={selectedEntry} onChange={onUpdateEntry} />
        ) : (
          <PlaceholderPanel text="Select an item from the builder to configure its properties." />
        )}
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

/* ── Preview modal ──────────────────────────────────────────────────────── */

function PreviewModal({ form, entries, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "620px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff" }}>{form.name || "Untitled template"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{TYPE_LABELS[form.type]} · {STRUCTURE_MODE_LABELS[form.structureType]}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px", width: "26px", height: "26px", borderRadius: "8px" }}>×</button>
        </div>
        <div style={{ padding: "20px 22px", maxHeight: "60vh", overflowY: "auto" }}>
          {form.description && <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#374151" }}>{form.description}</p>}
          {form.sections.map((section) => (
            <div key={section.id} style={{ marginBottom: "14px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 700, color: "#25476a" }}>{section.name}</p>
              {entries.filter((e) => e.sectionId === section.id).map((entry) => (
                <div key={entry.id} style={{ padding: "8px 10px", fontSize: "12.5px", color: "#374151", background: "#F9FAFB", borderRadius: "8px", marginBottom: "5px" }}>
                  {entryLabel(entry) || <em style={{ color: "#D1D5DB" }}>Untitled item</em>} <span style={{ color: "#9CA3AF" }}>· {ITEM_KIND_LABELS[entry.kind]}</span>
                </div>
              ))}
            </div>
          ))}
          {entries.filter((e) => !e.sectionId).length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 700, color: "#9CA3AF" }}>Unsectioned</p>
              {entries.filter((e) => !e.sectionId).map((entry) => (
                <div key={entry.id} style={{ padding: "8px 10px", fontSize: "12.5px", color: "#374151", background: "#F9FAFB", borderRadius: "8px", marginBottom: "5px" }}>
                  {entryLabel(entry) || <em style={{ color: "#D1D5DB" }}>Untitled item</em>} <span style={{ color: "#9CA3AF" }}>· {ITEM_KIND_LABELS[entry.kind]}</span>
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
    sections: [], items: [], indicators: [], deliverables: [], milestones: [],
  };
}

function buildFormFromTemplate(t) {
  return {
    type: t.type, name: t.name || "", description: t.description || "", instructions: t.instructions || "",
    structureType: t.structureType || "mixed", overview: t.overview || "",
    sections: t.sections || [],
    items: (t.items || []).map((item) => ({ ...normalizeLegacyItem(item), id: item.id || genId() })),
    indicators: (t.indicators || []).map((ind) => ({ id: ind.id || genId(), kind: ind.kind || "rating", sectionId: ind.sectionId || null, ...ind })),
    deliverables: (t.deliverables || []).map((d) => ({ ...d, id: d.id || genId() })),
    milestones: (t.milestones || []).map((m) => ({ ...m, id: m.id || genId() })),
  };
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function TemplateBuilderPage() {
  const { type: routeType, id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: templates = [], isLoading: loadingTemplates } = useTemplates();
  const { mutate: createTemplate, isPending: creating } = useCreateTemplate();
  const { mutate: updateTemplate, isPending: updating } = useUpdateTemplate();

  const editTarget = isEdit ? templates.find((t) => t.id === id) : null;

  const [form, setForm] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [focusedSectionId, setFocusedSectionId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (form) return;
    if (isEdit) {
      if (loadingTemplates || !editTarget) return;
      setForm(buildFormFromTemplate(editTarget));
    } else {
      setForm(buildBlankForm(routeType));
    }
  }, [form, isEdit, loadingTemplates, editTarget, routeType]);

  useEffect(() => { document.title = "Assessment Template Builder"; }, []);

  useEffect(() => {
    const el = document.createElement("style");
    el.id = "tb-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("tb-styles")?.remove(); };
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
    const payload = {
      name: form.name.trim(), type, description: form.description.trim(), instructions: form.instructions.trim(),
      structureType: form.structureType,
      sections: form.sections.map((s, i) => ({ ...s, order: i })),
    };
    if (BUILDER_REGISTRY[type]?.supportsDeliverables) payload.overview = form.overview.trim();
    payload.items = isObservation ? [] : form.items;
    payload.indicators = isObservation ? form.indicators : [];
    if (BUILDER_REGISTRY[type]?.supportsDeliverables) payload.deliverables = form.deliverables;
    if (BUILDER_REGISTRY[type]?.supportsMilestones) payload.milestones = form.milestones;
    return payload;
  }

  function handleSave() {
    if (!form.name.trim()) { setActiveTab("info"); return; }
    const data = buildPayload();
    const onSuccess = () => navigate("/settings");
    if (isEdit) updateTemplate({ id, data }, { onSuccess });
    else createTemplate(data, { onSuccess });
  }

  const isPending = creating || updating;
  const color = TYPE_COLORS[type];
  const tabs = [
    { key: "info", label: "Template Information" },
    { key: "structure", label: "Structure & Items" },
    ...(BUILDER_REGISTRY[type]?.supportsDeliverables ? [{ key: "deliverables", label: "Deliverables & Milestones" }] : []),
  ];

  return (
    <div className="tb-page">
      <div className="tb-header">
        <div>
          <p className="tb-crumb"><a onClick={() => navigate("/settings")}>Assessment Templates</a> / {isEdit ? "Edit Template" : "Create New Template"}</p>
          <div className="tb-title-row">
            <div className="tb-title-icon" style={{ backgroundColor: `${color}15`, color }}>{TYPE_ICONS[type]}</div>
            <div>
              <h1 className="tb-title">{TYPE_LABELS[type]} Template Builder</h1>
              <p className="tb-subtitle">Build a reusable {TYPE_LABELS[type].toLowerCase()} template. Add sections and assessment items of any type.</p>
            </div>
          </div>
        </div>
        <div className="tb-actions">
          <button type="button" className="tb-btn-secondary" onClick={() => setPreviewOpen(true)}>Preview Template</button>
          <button type="button" className="tb-btn-primary" onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : "Save Template"}</button>
        </div>
      </div>

      <div className="tb-body">
        <div className="tb-rail">
          <div>
            <p className="tb-rail-section-title">Assessment Templates</p>
            <button type="button" className="tb-rail-link active" onClick={() => navigate("/settings")}>
              <span className="tb-rail-dot" style={{ backgroundColor: color }} /> All Templates
            </button>
          </div>
          <div>
            <p className="tb-rail-section-title">Build New Template</p>
            {Object.keys(TYPE_LABELS).filter((t) => t !== "exam").map((t) => (
              <button key={t} type="button" className={`tb-rail-link${t === type && !isEdit ? " active" : ""}`} onClick={() => navigate(`/settings/templates/new/${t}`)}>
                <span className="tb-rail-dot" style={{ backgroundColor: TYPE_COLORS[t] }} /> {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="tb-tabs">
            {tabs.map((tab) => (
              <button key={tab.key} type="button" className={`tb-tab-btn${activeTab === tab.key ? " active" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
            ))}
          </div>

          {activeTab === "info" && (
            <div className="tb-card" style={{ maxWidth: "620px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <Label>Template Name *</Label>
                  <input className="tb-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Basic Concepts Quiz Template" />
                </div>
                <div>
                  <Label>Description</Label>
                  <textarea className="tb-textarea" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Default Instructions</Label>
                  <textarea className="tb-textarea" rows={3} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
                </div>
                {BUILDER_REGISTRY[type]?.supportsDeliverables && (
                  <div>
                    <Label>Project Overview</Label>
                    <textarea className="tb-textarea" rows={3} value={form.overview} onChange={(e) => setForm((f) => ({ ...f, overview: e.target.value }))} placeholder="What is this project about?" />
                  </div>
                )}
                <div>
                  <Label>Structure Type</Label>
                  <SegmentedControl options={STRUCTURE_MODES} value={form.structureType} onChange={(v) => setForm((f) => ({ ...f, structureType: v }))} />
                </div>
              </div>
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
              <RightPanel form={form} selectedEntry={selectedEntry} onUpdateEntry={updateEntry} />
            </div>
          )}

          {activeTab === "deliverables" && (
            <DeliverablesMilestonesTab
              deliverables={form.deliverables} milestones={form.milestones}
              onChangeDeliverables={(v) => setForm((f) => ({ ...f, deliverables: v }))}
              onChangeMilestones={(v) => setForm((f) => ({ ...f, milestones: v }))}
            />
          )}
        </div>
      </div>

      {previewOpen && <PreviewModal form={form} entries={entries} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}
