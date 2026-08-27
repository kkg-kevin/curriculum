import { useState, useRef } from "react";
import { FiChevronDown, FiChevronUp, FiLayers, FiTrash2 } from "react-icons/fi";
import {
  useSystemLevels, useCreateSystemLevel, useUpdateSystemLevel, useDeleteSystemLevel, useReorderSystemLevels,
} from "../hooks/useSystemLevels";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

// One row — sequence badge, an inline-editable name, reorder arrows, delete. Kept intentionally
// simple (no modal, no color/description) since a System Level is just a fixed position on the
// spine — every other detail (what a curriculum actually calls it) lives on the curriculum's
// own Curriculum Label/Short Label/Phase, not here.
function LevelRow({ level, index, count, onRename, onMoveUp, onMoveDown, onDelete, saving }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(level.name);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== level.name) onRename(trimmed);
    else setDraft(level.name);
  };

  return (
    <div className="stg-item" style={{ display: "flex", flexDirection: "row", alignItems: "center", textAlign: "left", gap: "12px", padding: "10px 14px" }}>
      <span style={{ width: "26px", height: "26px", borderRadius: "8px", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", color: "#25476a", fontSize: "12px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {level.sequence}
      </span>

      {editing ? (
        <input
          autoFocus
          className="stg-input"
          style={{ flex: 1, padding: "6px 10px" }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(level.name); setEditing(false); }
          }}
        />
      ) : (
        <span
          onClick={() => { setDraft(level.name); setEditing(true); }}
          style={{ flex: 1, fontSize: "13.5px", fontWeight: "700", color: "#111827", cursor: "text" }}
          title="Click to rename"
        >
          {level.name}
        </span>
      )}

      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
        <button type="button" className="stg-icon-btn" disabled={index === 0} onClick={onMoveUp} title="Move up">
          <FiChevronUp size={14} strokeWidth={2} />
        </button>
        <button type="button" className="stg-icon-btn" disabled={index === count - 1} onClick={onMoveDown} title="Move down">
          <FiChevronDown size={14} strokeWidth={2} />
        </button>
        <button type="button" className="stg-icon-btn danger" disabled={saving} onClick={onDelete} title="Delete">
          <FiTrash2 size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export default function SystemLevelsPanel() {
  const { data: levels = [], isLoading } = useSystemLevels();
  const { mutate: create, isPending: creating } = useCreateSystemLevel();
  const { mutate: update } = useUpdateSystemLevel();
  const { mutate: remove, isPending: deleting } = useDeleteSystemLevel();
  const { mutate: reorder } = useReorderSystemLevels();
  const [deleteTarget, setDeleteTarget] = useState(null);
  // `creating` (React Query's isPending) only flips true once the mutation's own state update
  // has flowed through a re-render — a fast double-click on "+ Add Level" can fire twice before
  // that happens, racing two identically-named creates past each other (see
  // system-level.service.js's createSystemLevel). This ref disables the button synchronously,
  // in the same tick as the first click, closing that gap regardless of render timing.
  const addInFlight = useRef(false);

  if (isLoading) return <div className="stg-spinner" />;

  const move = (index, direction) => {
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= levels.length) return;
    const ids = levels.map((l) => l.id);
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
    reorder(ids);
  };

  const addLevel = (name) => {
    if (addInFlight.current) return;
    addInFlight.current = true;
    create({ name }, { onSettled: () => { addInFlight.current = false; } });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>System Levels</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {levels.length} level{levels.length !== 1 ? "s" : ""} — the fixed spine every curriculum's grades map onto, so the same position is recognized across different curricula regardless of what each one calls it (e.g. "Grade 4" vs "Year 5"). Configured per curriculum on its own Structure page.
          </p>
        </div>
        <button
          type="button"
          className="stg-btn-primary"
          disabled={creating}
          onClick={() => addLevel(`Level ${levels.length + 1}`)}
        >
          + Add Level
        </button>
      </div>

      {levels.length === 0 ? (
        <div className="stg-empty">
          <div style={{ marginBottom: "12px", color: "#25476a" }}>
            <FiLayers size={40} strokeWidth={1.8} />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No system levels yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Add levels in order (e.g. Level 1 through Level 14) to build the spine curricula map their grades onto.
          </p>
          <button type="button" className="stg-btn-primary" disabled={creating} onClick={() => addLevel("Level 1")}>
            + Add Level
          </button>
        </div>
      ) : (
        <div className="stg-list" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {levels.map((level, i) => (
            <LevelRow
              key={level.id}
              level={level}
              index={i}
              count={levels.length}
              saving={deleting}
              onRename={(name) => update({ id: level.id, data: { name } })}
              onMoveUp={() => move(i, -1)}
              onMoveDown={() => move(i, 1)}
              onDelete={() => setDeleteTarget(level)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete System Level"
        message={`"${deleteTarget?.name}" will be removed. If any curriculum still has a grade mapped to it, this will be blocked until that mapping is removed first.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
