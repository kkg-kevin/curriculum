import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { FiCheck, FiCopy, FiExternalLink, FiEye, FiGlobe, FiLock } from "react-icons/fi";
import { Modal, QaStyles as CheckinStyles, btn, hint, input, label } from "../../qa/shared";
import { BRAND, FONT, card, pill } from "../../../theme/brand";
import { useSaveMyEducatorProfile } from "../hooks/useEducatorProfile";
import { publicProfileUrl } from "../services/educatorProfileApi";
import PublicProfileView from "./PublicProfileView";

// The educator's public profile, as they manage it (teacher portal → My profile → Public profile):
// what they write about themself, whether to share it (an admin checks it before it goes public), a
// preview of what families see, and the link + QR once published. Their figures, badges and ratings
// come from their teaching — never typed in.

export const OWN_STATE = {
  private: { label: "Private", tone: "neutral", text: "Only you, your supervisor and the admins see your profile." },
  pending: { label: "Waiting for approval", tone: "waiting", text: "You've chosen to share it — an admin checks it, then it goes public." },
  published: { label: "Published", tone: "good", text: "Live. Share the link — families also find you in their portal." },
  changes: { label: "Changes waiting", tone: "info", text: "Published. Your latest changes go live once an admin checks them." },
};
const list = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);

export default function PublicProfileEditor({ profile }) {
  const save = useSaveMyEducatorProfile();
  const [form, setForm] = useState(null);
  const [optIn, setOptIn] = useState(false);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const a = profile.aboutDraft || profile.about || {};
    setForm({ headline: a.headline || "", bio: a.bio || "", specialties: (a.specialties || []).join(", "), languages: (a.languages || []).join(", "), ageRange: a.ageRange || "" });
    setOptIn(!!profile.publish.optIn);
  }, [profile]);
  if (!form) return null;

  const look = OWN_STATE[profile.publish.state];
  const url = profile.publish.slug ? publicProfileUrl(profile.publish.slug) : null;
  const about = { headline: form.headline, bio: form.bio, specialties: list(form.specialties), languages: list(form.languages), ageRange: form.ageRange };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ } };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", alignItems: "start", fontFamily: FONT }}>
      <CheckinStyles />
      <section style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: BRAND.ink, display: "flex", alignItems: "center", gap: 8 }}><FiGlobe color={BRAND.mid} /> About you</h2>
          <span style={pill(look.tone)}>{look.label}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>{look.text}</p>
        {profile.publish.reviewNote && profile.publish.state !== "published" && (
          <p style={{ margin: 0, padding: "9px 12px", borderRadius: 10, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, color: BRAND.goldText, fontSize: 12.5 }}>An admin asked: &ldquo;{profile.publish.reviewNote}&rdquo;</p>
        )}

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
          <div>
            <label htmlFor="ep-headline" style={label}>Headline</label>
            <input id="ep-headline" value={form.headline} onChange={set("headline")} maxLength={120} placeholder="e.g. Robotics & coding mentor for ages 8–14" style={input} />
          </div>
          <div>
            <label htmlFor="ep-ages" style={label}>Ages you teach</label>
            <input id="ep-ages" value={form.ageRange} onChange={set("ageRange")} maxLength={30} placeholder="e.g. 8–14" style={input} />
          </div>
          <div>
            <label htmlFor="ep-spec" style={label}>What you teach best</label>
            <input id="ep-spec" value={form.specialties} onChange={set("specialties")} placeholder="Scratch, Robotics, Python" style={input} />
            <p style={hint}>Separate with commas — up to 8.</p>
          </div>
          <div>
            <label htmlFor="ep-lang" style={label}>Languages</label>
            <input id="ep-lang" value={form.languages} onChange={set("languages")} placeholder="English, Kiswahili" style={input} />
          </div>
        </div>
        <div>
          <label htmlFor="ep-bio" style={label}>Introduce yourself</label>
          <textarea id="ep-bio" value={form.bio} onChange={set("bio")} rows={5} maxLength={1500} placeholder="How you teach, what learners enjoy in your sessions, your background…" style={{ ...input, resize: "vertical", lineHeight: 1.55 }} />
          <p style={hint}>{form.bio.length}/1500 · Your figures, badges and ratings come from your teaching — you can&apos;t edit those.</p>
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: BRAND.ink, cursor: "pointer", padding: "11px 13px", borderRadius: 12, background: optIn ? BRAND.skyTint : BRAND.canvas, border: `1.5px solid ${optIn ? BRAND.skyBorder : BRAND.line}` }}>
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} style={{ marginTop: 3 }} />
          <span><strong>Share my profile.</strong> An admin checks it first; then anyone with the link can see it and families can find you in their portal. Never shown: your contact details, pay, quality-review scores or anything a parent didn&apos;t agree to share. Untick it any time to take it down.</span>
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="ci-btn" disabled={save.isPending} onClick={() => save.mutate({ about, optIn })} style={btn("primary", { disabled: save.isPending })}>{save.isPending ? "Saving…" : "Save"}</button>
          <button type="button" className="ci-btn" onClick={() => setPreview(true)} style={btn("secondary")}><FiEye size={14} style={{ marginRight: 6 }} /> Preview</button>
        </div>
      </section>

      <section style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, gridColumn: "1 / -1" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Your link</h2>
        {profile.publish.public && url ? (
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ padding: 8, background: BRAND.surface, borderRadius: 12, border: `1px solid ${BRAND.line}` }}><QRCodeCanvas value={url} size={96} fgColor={BRAND.navy} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: "1 1 220px" }}>
              <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: BRAND.mid, overflowWrap: "anywhere", fontWeight: 600 }}>{url} <FiExternalLink size={11} /></a>
              <p style={{ margin: 0, fontSize: 12, color: BRAND.muted }}>Share it with families, on your social media, or print the QR code.</p>
              <button type="button" className="ci-btn" onClick={copy} style={{ ...btn("secondary", { size: "sm" }), alignSelf: "flex-start" }}>{copied ? <><FiCheck size={12} style={{ marginRight: 4 }} /> Copied</> : <><FiCopy size={12} style={{ marginRight: 4 }} /> Copy link</>}</button>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, display: "flex", alignItems: "center", gap: 6 }}><FiLock size={13} /> Your link appears here once your profile is published.</p>
        )}
      </section>

      {preview && (
        <Modal title="How families will see your profile" onClose={() => setPreview(false)} width={980}>
          <PublicProfileView profile={{ ...profile.preview, ...about }} note={<p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>A preview with what you&apos;ve typed — save it, and it goes public once an admin checks it.</p>} />
        </Modal>
      )}
    </div>
  );
}
