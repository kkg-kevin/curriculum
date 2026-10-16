import { createPortal } from "react-dom";

// Offers back a draft of unsaved work that an earlier visit left on the record being opened (kept
// in the workspace by hooks/useWorkspaceDraft.js — anyone on the account may have written it). A
// dialog rather than a banner: until a choice is made nothing new is kept as a draft, so the form
// must not be typed into behind it.

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
 * draft           — the draft on offer, as the drafts list gives it ({ updatedAt, createdAt,
 *                   lastEditedByName }), or null to show nothing
 * recordUpdatedAt — the record's updatedAt as just loaded; later than the draft's start means the
 *                   record was saved again after the draft began
 * what            — "assessment", "course", "session" — used in the wording
 * listedOn        — where the record's other drafts are listed ("the Assessments page")
 * otherCount      — how many more drafts there are of the same record
 * onDismiss       — "Not now": the form opens as saved and the draft is left for later
 */
export default function DraftRestoreDialog({ draft, recordUpdatedAt = null, what, listedOn, otherCount = 0, onRestore, onDiscard, onDismiss }) {
  if (!draft) return null;
  const savedSince = Boolean(recordUpdatedAt && draft.createdAt && new Date(recordUpdatedAt) > new Date(draft.createdAt));

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
          This {what} has unsaved changes from <strong>{formatWhen(draft.updatedAt)}</strong>{draft.lastEditedByName ? <>, by {draft.lastEditedByName}</> : null}.
        </p>
        {savedSince && (
          <p style={{ margin: "0 0 12px 0", padding: "10px 12px", fontSize: "13px", color: "#92400E", background: "#FEF3C7", borderRadius: "10px", lineHeight: "1.5" }}>
            It has been saved again since then. Restoring puts this draft back over that version; nothing changes until you save.
          </p>
        )}
        <p style={{ margin: "0 0 24px 0", fontSize: "13px", color: "#6B7280", lineHeight: "1.55" }}>
          Restore brings the changes back so you can carry on and save. Discard deletes them for good, for everyone on this account.
          {onDismiss ? " Not now opens the saved version and leaves the draft for later." : ""}
          {otherCount > 0 && listedOn ? ` ${otherCount === 1 ? "One more unsaved draft" : `${otherCount} more unsaved drafts`} of this ${what} ${otherCount === 1 ? "is" : "are"} listed on ${listedOn}.` : ""}
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          {onDismiss && (
            <button type="button" onClick={onDismiss} style={{ ...button, backgroundColor: "transparent", color: "#4B5563", border: "1.5px solid #E5E7EB", marginRight: "auto" }}>
              Not now
            </button>
          )}
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

// "Draft saved · 10:42" — the line beside a Save button while useWorkspaceDraft is keeping the
// form's unsaved work in the workspace.
export function WorkspaceDraftNote({ status, style }) {
  const { state, savedAt } = status || {};
  if (!state || state === "idle") return null;
  const time = savedAt ? new Date(savedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) : null;
  const text = {
    saving: "Saving draft…",
    saved: `Draft saved${time ? ` · ${time}` : ""}`,
    error: "Draft not saved yet — retrying",
    failed: "Draft couldn't be saved — save to keep your work",
  }[state];
  const color = state === "error" || state === "failed" ? "#B45309" : "#9CA3AF";
  return (
    <span
      style={{ fontSize: "12px", color, fontFamily: "Inter, sans-serif", ...style }}
      title="Until you save, your changes are kept as a draft that everyone on this account can see and carry on."
    >
      {text}
    </span>
  );
}
