import { createPortal } from "react-dom";

// Offers back a draft that hooks/useDraft.js kept from an earlier, unsaved visit to the same
// form. A dialog rather than a banner: until Restore or Discard is chosen nothing new is kept
// as a draft, so the form must not be typed into behind it.

function formatWhen(iso) {
  return new Date(iso).toLocaleString("en-KE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const button = {
  padding: "9px 18px",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: "600",
  fontFamily: "Inter, sans-serif",
  cursor: "pointer",
};

/**
 * draft          — useDraft's `found` ({ savedAt, baseUpdatedAt }), or null to show nothing
 * recordUpdatedAt — when editing, the record's updatedAt as just loaded; if it differs from the
 *                   draft's, the record was saved again after the draft was written
 * what           — "assessment", "course", "session" — used in the wording
 */
export default function DraftRestoreDialog({ draft, recordUpdatedAt = null, what, onRestore, onDiscard }) {
  if (!draft) return null;
  const savedSince = Boolean(recordUpdatedAt && draft.baseUpdatedAt && recordUpdatedAt !== draft.baseUpdatedAt);

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-restore-title"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          padding: "28px 28px 24px",
          maxWidth: "440px",
          width: "calc(100% - 32px)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <h2 id="draft-restore-title" style={{ margin: "0 0 10px 0", fontSize: "17px", fontWeight: "700", color: "#111827" }}>
          Pick up where you left off?
        </h2>
        <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#4B5563", lineHeight: "1.55" }}>
          This {what} has unsaved changes from <strong>{formatWhen(draft.savedAt)}</strong>, kept on this device.
        </p>
        {savedSince && (
          <p style={{ margin: "0 0 12px 0", padding: "10px 12px", fontSize: "13px", color: "#92400E", background: "#FEF3C7", borderRadius: "10px", lineHeight: "1.5" }}>
            It has been saved again since then. Restoring puts your draft back over that version; nothing changes until you save.
          </p>
        )}
        <p style={{ margin: "0 0 24px 0", fontSize: "13px", color: "#6B7280", lineHeight: "1.55" }}>
          Restore brings the changes back so you can carry on and save. Discard deletes them for good.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" onClick={onDiscard} style={{ ...button, backgroundColor: "transparent", color: "#B91C1C", border: "1.5px solid #FECACA" }}>
            Discard changes
          </button>
          <button type="button" onClick={onRestore} autoFocus style={{ ...button, backgroundColor: "#25476a", color: "#ffffff", border: "none" }}>
            Restore
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// "Draft kept on this device · 10:42" — a quiet line beside a Save button while useDraft is
// holding unsaved changes.
export function DraftSavedNote({ savedAt, style }) {
  if (!savedAt) return null;
  const time = new Date(savedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
  return (
    <span style={{ fontSize: "12px", color: "#9CA3AF", fontFamily: "Inter, sans-serif", ...style }} title="Unsaved changes are kept in this browser until you save, in case the page closes.">
      Draft kept on this device · {time}
    </span>
  );
}
