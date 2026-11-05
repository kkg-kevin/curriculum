import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { FiCheck, FiCopy, FiDownload, FiExternalLink, FiEye, FiGlobe, FiMail, FiPhone } from "react-icons/fi";
import { Modal, QaStyles as CheckinStyles, btn, input } from "../../qa/shared";
import { publicProfileUrl } from "../services/educatorProfileApi";
import { useHandleMentorRequest, useReviewEducatorProfile } from "../hooks/useEducatorProfile";
import PublicProfileView from "./PublicProfileView";
import { BRAND, pill } from "../../../theme/brand";

// The educator's public profile, for admins and the supervisor (on the educator page): where it
// stands — private, waiting for approval, published, or published with changes waiting — a preview,
// Publish / Send back / Take down (admins), the share link with its QR, and families who asked for them
// in the parent portal.

// States in the system colours (theme/brand.js): published blue, waiting gold, changes sky, private grey.
export const PROFILE_STATE = {
  private: { label: "Private", tone: "neutral", text: "The educator hasn't chosen to share their profile." },
  pending: { label: "Waiting for approval", tone: "waiting", text: "They'd like to share their profile. Check the preview, then publish it or send it back." },
  published: { label: "Published", tone: "good", text: "Live — anyone with the link can see it, and families find it in the parent portal." },
  changes: { label: "Changes waiting", tone: "info", text: "Published; they changed their About since. Publish the change or send it back." },
};
const STATE = PROFILE_STATE;

export default function PublishingCard({ profile, teacherId, canPublish }) {
  const review = useReviewEducatorProfile(teacherId);
  const handle = useHandleMentorRequest();
  const [preview, setPreview] = useState(false);
  const [sendBack, setSendBack] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);
  const p = profile.publish;
  const look = STATE[p.state];
  const url = p.slug ? publicProfileUrl(p.slug) : null;
  const open = (profile.requests || []).filter((r) => r.status === "open");

  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } };
  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${p.slug}-profile-qr.png`;
    a.click();
  };

  return (
    <section style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
      <CheckinStyles />
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "0.07em", display: "inline-flex", alignItems: "center", gap: 6 }}><FiGlobe size={12} /> Public profile</h2>
        <span style={pill(look.tone)}>{look.label}</span>
      </div>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "#4B5563", lineHeight: 1.55 }}>{look.text}</p>
        {p.reviewNote && p.state !== "published" && <p style={{ margin: 0, fontSize: 12, color: BRAND.goldText }}>Sent back: &ldquo;{p.reviewNote}&rdquo;</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="ci-btn" onClick={() => setPreview(true)} style={btn("secondary", { size: "sm" })}><FiEye size={13} style={{ marginRight: 5 }} /> Preview</button>
          {canPublish && (p.state === "pending" || p.state === "changes") && (
            <>
              <button type="button" className="ci-btn" disabled={review.isPending} onClick={() => review.mutate({ action: "approve" })} style={btn("primary", { size: "sm", disabled: review.isPending })}>Publish</button>
              <button type="button" className="ci-btn" disabled={review.isPending} onClick={() => setSendBack(true)} style={btn("secondary", { size: "sm" })}>Send back</button>
            </>
          )}
          {canPublish && p.public && (
            <button type="button" className="ci-btn" disabled={review.isPending} onClick={() => { if (window.confirm("Take this profile down? The link stops working until it's published again.")) review.mutate({ action: "unpublish" }); }} style={btn("danger", { size: "sm" })}>Take down</button>
          )}
        </div>

        {p.public && url && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", borderRadius: 12, background: BRAND.canvas, border: `1px solid ${BRAND.line}` }}>
            <div ref={qrRef} style={{ flexShrink: 0 }}><QRCodeCanvas value={url} size={84} includeMargin={false} /></div>
            <div style={{ minWidth: 0, flex: "1 1 160px", display: "flex", flexDirection: "column", gap: 6 }}>
              <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: BRAND.mid, overflowWrap: "anywhere" }}>{url} <FiExternalLink size={11} /></a>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="ci-btn" onClick={copy} style={btn("secondary", { size: "sm" })}>{copied ? <><FiCheck size={12} style={{ marginRight: 4 }} /> Copied</> : <><FiCopy size={12} style={{ marginRight: 4 }} /> Copy link</>}</button>
                <button type="button" className="ci-btn" onClick={downloadQr} style={btn("secondary", { size: "sm" })}><FiDownload size={12} style={{ marginRight: 4 }} /> QR</button>
              </div>
            </div>
          </div>
        )}

        {profile.requests?.length > 0 && (
          <div>
            <p style={{ margin: "4px 0 8px", fontSize: 12.5, fontWeight: 800, color: "#111827" }}>Families asking for them {open.length ? <span style={{ color: BRAND.goldText }}>· {open.length} open</span> : null}</p>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
              {profile.requests.slice(0, 6).map((r) => (
                <div key={r.id} style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${r.status === "open" ? BRAND.goldBorder : BRAND.line}`, background: r.status === "open" ? BRAND.goldTint : BRAND.surface, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong>{r.parent.name} — for {r.learner.name}</strong>
                    <span style={{ color: "#9CA3AF", fontSize: 11.5 }}>{new Date(r.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>
                  </div>
                  {r.note && <p style={{ margin: "4px 0 0", color: "#374151" }}>&ldquo;{r.note}&rdquo;</p>}
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6, flexWrap: "wrap", color: "#4B5563" }}>
                    {r.parent.email && <a href={`mailto:${r.parent.email}`} style={{ color: BRAND.mid, display: "inline-flex", gap: 4, alignItems: "center" }}><FiMail size={12} /> {r.parent.email}</a>}
                    {r.parent.phone && <a href={`tel:${r.parent.phone}`} style={{ color: BRAND.mid, display: "inline-flex", gap: 4, alignItems: "center" }}><FiPhone size={12} /> {r.parent.phone}</a>}
                    {r.status === "open" ? (
                      <button type="button" className="ci-btn" disabled={handle.isPending} onClick={() => handle.mutate(r.id)} style={{ ...btn("secondary", { size: "sm" }), marginLeft: "auto" }}>Mark handled</button>
                    ) : <span style={{ marginLeft: "auto", ...pill("good") }}>Handled</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {preview && (
        <Modal title="How families will see this profile" onClose={() => setPreview(false)} width={980}>
          <PublicProfileView profile={profile.preview} />
        </Modal>
      )}
      {sendBack && (
        <Modal
          title="Send the profile back"
          onClose={() => setSendBack(false)}
          footer={(
            <>
              <button type="button" className="ci-btn" onClick={() => setSendBack(false)} style={btn("secondary")}>Cancel</button>
              <button type="button" className="ci-btn" disabled={!note.trim() || review.isPending} onClick={() => review.mutate({ action: "send_back", note }, { onSuccess: () => { setSendBack(false); setNote(""); } })} style={btn("primary", { disabled: !note.trim() || review.isPending })}>Send back</button>
            </>
          )}
        >
          <label htmlFor="pp-note" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>What should they change?</label>
          <textarea id="pp-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={500} style={{ ...input, resize: "vertical" }} placeholder="e.g. Add the ages you teach, and shorten the introduction." />
        </Modal>
      )}
    </section>
  );
}
