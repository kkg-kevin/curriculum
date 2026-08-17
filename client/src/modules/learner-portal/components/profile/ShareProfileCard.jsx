import { useState } from "react";
import { FiShare2 } from "react-icons/fi";
import { QRCodeSVG } from "qrcode.react";
import { T, cardStyle, sectionHeaderStyle } from "./theme";
import { usePublicToken, useRegeneratePublicToken } from "../../../learners/hooks/useLearners";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

// The learner/guardian-side counterpart to LearnerViewPage.jsx's own ShareProfileCard (admin/
// school-portal) — same token, same server endpoints, same deliberately narrow public view (see
// learner.service.js's getPublicProfile). Lets a guardian pull up or reprint their own child's
// QR without needing a staff member to do it, e.g. to show at pickup or hand to reception.
// Deliberately compact — QR + link sit side-by-side rather than stacked, so this doesn't dominate
// the page next to Guardian Profile/Portfolio Snapshot's own much shorter cards.
export default function ShareProfileCard({ learnerId }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [copied, setCopied] = useState(false);
  const { mutate: fetchToken, isPending: loadingToken } = usePublicToken();
  const { mutate: regenerate, isPending: regenerating } = useRegeneratePublicToken();

  const handleToggle = () => {
    setOpen((v) => !v);
    if (!token) fetchToken(learnerId, { onSuccess: (data) => setToken(data.token) });
  };

  const handleRegenerate = () => {
    setConfirmRegenerate(false);
    regenerate(learnerId, { onSuccess: (data) => setToken(data.token) });
  };

  const publicUrl = token ? `${window.location.origin}/public/learners/${token}` : "";

  const handleCopy = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ ...cardStyle(), borderTop: `3px solid ${T.accentMid}`, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 260 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: T.tintBg, color: T.accentMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FiShare2 size={12} />
          </div>
          <p style={sectionHeaderStyle()}>Share Profile</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
            backgroundColor: open ? "#F3F4F6" : T.tintBg, color: open ? T.inkMuted : T.accent, border: `1.5px solid ${open ? T.border : T.tintBorder}`,
          }}
        >
          {open ? "Hide" : "Show QR"}
        </button>
      </div>

      {!open ? (
        <p style={{ margin: 0, fontSize: 12, color: T.inkFaint, lineHeight: 1.4 }}>
          No-login view — shows this learner's full profile (identity, guardian contact, competencies, and progress). Individual assessment scores and teacher feedback stay private.
        </p>
      ) : loadingToken && !token ? (
        <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ padding: 6, backgroundColor: T.tintBg, borderRadius: 10, flexShrink: 0, lineHeight: 0 }}>
            <QRCodeSVG value={publicUrl} size={84} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                readOnly
                value={publicUrl}
                onFocus={(e) => e.target.select()}
                style={{ flex: 1, minWidth: 0, padding: "6px 8px", borderRadius: 7, border: `1.5px solid ${T.border}`, fontSize: 11, fontFamily: "Inter, sans-serif", color: T.inkMuted }}
              />
              <button
                type="button"
                onClick={handleCopy}
                style={{ padding: "6px 10px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 7, fontSize: 11, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0 }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setConfirmRegenerate(true)}
              disabled={regenerating}
              style={{ alignSelf: "flex-start", padding: 0, background: "none", border: "none", color: "#B91C1C", fontSize: 11, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: regenerating ? "not-allowed" : "pointer" }}
            >
              {regenerating ? "Regenerating…" : "Regenerate link"}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmRegenerate}
        title="Regenerate Share Link"
        message="The current QR code and link will stop working immediately. Anyone who still has the old one won't be able to view this profile anymore."
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleRegenerate}
        onCancel={() => setConfirmRegenerate(false)}
      />
    </div>
  );
}
