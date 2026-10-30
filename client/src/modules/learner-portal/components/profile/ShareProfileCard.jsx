import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { KID, KidHeading, T, cardStyle } from "./theme";
import { usePublicToken, useRegeneratePublicToken } from "../../../learners/hooks/useLearners";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";
import ShareQrTools from "../../../learners/components/ShareQrTools";
import { FiShare2 } from "react-icons/fi";

// The learner's no-login share link — on their own profile, and on the staff learner page
// (LearnerPage.jsx, admin/school-portal): same token, same server endpoints, same deliberately
// narrow public view (see learner.service.js's getPublicProfile). Lets a guardian pull up or reprint their own child's
// QR without needing a staff member to do it, e.g. to show at pickup or hand to reception.
// Deliberately compact — QR + link sit side-by-side rather than stacked, so this doesn't dominate
// the page next to Guardian Profile/Portfolio Snapshot's own much shorter cards.
export default function ShareProfileCard({ learner }) {
  const learnerId = learner.id;
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
    <div style={{ ...cardStyle(), padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 260 }}>
      <KidHeading icon={FiShare2} tone={KID.navy} action={
        <button
          type="button"
          onClick={handleToggle}
          style={{
            padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", flexShrink: 0,
            backgroundColor: open ? "#F3F4F6" : KID.navy.color, color: open ? T.inkMuted : "#fff", border: `2px solid ${open ? T.border : KID.navy.color}`,
          }}
        >
          {open ? "Hide" : "Show QR"}
        </button>
      }>Share Profile</KidHeading>

      {!open ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted, lineHeight: 1.5 }}>
          A page anyone with the link or QR code can open — no login needed. It shows the learner&apos;s levels, skills, pathways, courses and attendance. Contact details, fees, marks and teacher notes stay private.
        </p>
      ) : loadingToken && !token ? (
        <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>Loading…</p>
      ) : (
        <>
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
        {token && <ShareQrTools learner={learner} publicUrl={publicUrl} />}
        </>
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
