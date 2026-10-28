import { useState, useRef } from "react";
import { FiChevronLeft, FiChevronRight, FiInfo, FiLayers, FiTrash2 } from "react-icons/fi";
import {
  useSystemLevels, useCreateSystemLevel, useUpdateSystemLevel, useDeleteSystemLevel, useReorderSystemLevels,
} from "../hooks/useSystemLevels";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";
import { systemLevelsApi } from "../services/systemLevelsApi";

// One tile — sequence badge and an inline-editable name, with move earlier / later and delete
// shown on hover or keyboard focus (settingsStyles.js's .stg-level). Kept intentionally simple
// (no modal, no color/description) since a System Level is just a fixed position on the spine —
// every other detail (what a curriculum actually calls it) lives on the curriculum's own
// Curriculum Label/Short Label/Phase, not here.
function LevelTile({ level, index, count, onRename, onMoveUp, onMoveDown, onDelete, saving }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(level.name);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== level.name) onRename(trimmed);
    else setDraft(level.name);
  };

  return (
    <div className="stg-level" role="listitem">
      <span className="stg-level-num" aria-hidden="true">{level.sequence}</span>

      {editing ? (
        <input
          autoFocus
          className="stg-input stg-level-input"
          aria-label={`Name of level ${level.sequence}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(level.name); setEditing(false); }
          }}
        />
      ) : (
        <>
          <button
            type="button"
            className="stg-level-name"
            onClick={() => { setDraft(level.name); setEditing(true); }}
            title={`${level.name} — click to rename`}
            aria-label={`Level ${level.sequence}: ${level.name}. Rename`}
          >
            {level.name}
          </button>
          <div className="stg-level-actions">
            <button type="button" className="stg-icon-btn" disabled={index === 0} onClick={onMoveUp} title="Move earlier" aria-label={`Move ${level.name} earlier`}>
              <FiChevronLeft size={14} strokeWidth={2.2} />
            </button>
            <button type="button" className="stg-icon-btn" disabled={index === count - 1} onClick={onMoveDown} title="Move later" aria-label={`Move ${level.name} later`}>
              <FiChevronRight size={14} strokeWidth={2.2} />
            </button>
            <button type="button" className="stg-icon-btn danger" disabled={saving} onClick={onDelete} title="Delete" aria-label={`Delete ${level.name}`}>
              <FiTrash2 size={13} strokeWidth={2} />
            </button>
          </div>
        </>
      )}
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
  const [showAbout, setShowAbout] = useState(false);
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
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>
            System Levels{levels.length > 0 && <span style={{ marginLeft: "6px", fontSize: "13px", fontWeight: "700", color: "#9CA3AF" }}>· {levels.length}</span>}
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF", display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
            The shared spine every curriculum&apos;s grades map onto.
            <button
              type="button"
              onClick={() => setShowAbout((v) => !v)}
              aria-expanded={showAbout}
              aria-label="About system levels"
              title="About system levels"
              style={{ display: "inline-flex", padding: 0, border: "none", background: "none", cursor: "pointer", color: showAbout ? "#25476a" : "#9CA3AF" }}
            >
              <FiInfo size={13} />
            </button>
          </p>
          {showAbout && (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6B7280", lineHeight: "1.6", maxWidth: "640px" }}>
              The same position is recognised across different curricula whatever each one calls it (e.g. &quot;Grade 4&quot; vs &quot;Year 5&quot;) — each curriculum maps its grades onto these on its own Structure page. Click a level&apos;s name to rename it; point at it to move it earlier or later, or delete it.
            </p>
          )}
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
        <div className="stg-level-grid" role="list" aria-label="System levels, in order">
          {levels.map((level, i) => (
            <LevelTile
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
        message={`"${deleteTarget?.name}" will be removed.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        usageCheck={() => systemLevelsApi.checkDeleteSystemLevel(deleteTarget.id)}
      />
    </div>
  );
}
