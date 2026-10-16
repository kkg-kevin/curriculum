import { useState } from "react";
import { FiChevronRight, FiEdit3, FiTrash2 } from "react-icons/fi";
import ConfirmDialog from "../../modules/curriculum/components/ConfirmDialog";

// A draft of unsaved work (hooks/useWorkspaceDraft.js) shown as a card among the saved records on
// the Assessments and Courses pages — first in the grid, marked out by a dashed amber border and an
// "Unsaved draft" label. Continue opens the form on it; Delete removes it for everyone.

const AMBER = { bg: "#FFF8E6", border: "#F5C451", text: "#9A6700" };

function formatWhen(iso) {
  return new Date(iso).toLocaleString("en-KE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function UnsavedDraftBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 9px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.03em", backgroundColor: AMBER.bg, color: AMBER.text, border: `1px solid ${AMBER.border}`, whiteSpace: "nowrap" }}>
      <FiEdit3 size={10} strokeWidth={2.6} />
      UNSAVED DRAFT
    </span>
  );
}

/**
 * draft     — the drafts list row (updatedAt, lastEditedByName)
 * title     — what it's called so far; `untitled` greys it out
 * subtitle  — what the draft is ("New course, not saved yet")
 * Icon      — the record type's icon
 * badges    — more badges beside the title (an assessment's type)
 * cover     — true for the Courses grid's layout: a cover-height band on top, like a course card
 */
export default function DraftCard({ draft, title, untitled = false, subtitle, Icon = FiEdit3, badges = null, cover = false, onOpen, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const meta = (
    <p style={{ margin: 0, fontSize: "12.5px", color: "#6B7280", lineHeight: "1.55" }}>
      {subtitle}
      <br />
      <span style={{ color: "#9CA3AF" }}>
        Last edited {formatWhen(draft.updatedAt)}{draft.lastEditedByName ? ` by ${draft.lastEditedByName}` : ""}
      </span>
    </p>
  );

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
      style={{
        backgroundColor: "#FFFDF7", borderRadius: "16px", cursor: "pointer",
        border: `2px dashed ${AMBER.border}`,
        boxShadow: hovered ? "0 8px 24px rgba(154,103,0,0.14), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.05)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {cover && (
        <div style={{ position: "relative", height: "136px", flexShrink: 0, background: "repeating-linear-gradient(135deg, #FFF3D6 0 12px, #FFF8E6 12px 24px)", display: "flex", alignItems: "center", justifyContent: "center", color: AMBER.text }}>
          <Icon size={30} strokeWidth={1.8} />
          <div style={{ position: "absolute", top: "10px", left: "10px" }}>
            <UnsavedDraftBadge />
          </div>
        </div>
      )}

      <div style={{ padding: cover ? "16px 18px" : "18px 20px", display: "flex", flexDirection: "column", gap: cover ? "8px" : "12px", flex: 1 }}>
        {cover ? (
          <>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: untitled ? "#9CA3AF" : "#111827", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {title}
            </h3>
            {badges && <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>{badges}</div>}
            {meta}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: AMBER.bg, border: `1.5px solid ${AMBER.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: AMBER.text }}>
                <Icon size={20} strokeWidth={1.9} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "15px", fontWeight: "700", color: untitled ? "#9CA3AF" : "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {title}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <UnsavedDraftBadge />
                  {badges}
                </div>
              </div>
            </div>
            {meta}
          </>
        )}
      </div>

      <div style={{ padding: "10px 20px", borderTop: `1px dashed ${AMBER.border}`, backgroundColor: AMBER.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          style={{ background: "none", border: "none", fontSize: "13px", fontWeight: "700", color: AMBER.text, cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}
        >
          Continue
          <FiChevronRight size={12} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
          title="Delete draft"
          aria-label={`Delete draft ${title}`}
          style={{ width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "#DC2626", cursor: "pointer" }}
        >
          <FiTrash2 size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Inside the card's click area — stop clicks in the dialog from also opening the draft. */}
      <div onClick={(e) => e.stopPropagation()}>
        <ConfirmDialog
          isOpen={confirmOpen}
          title="Delete Draft"
          message={`The unsaved work in "${title}" will be deleted for everyone on this account. This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => { setConfirmOpen(false); onDelete(); }}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </div>
  );
}
