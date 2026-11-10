import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { FiAward, FiCheck, FiCopy, FiEdit3, FiExternalLink, FiEye, FiGlobe, FiLock, FiSend, FiStar, FiUsers } from "react-icons/fi";
import { Modal, QaStyles as CheckinStyles, btn, hint, input, label } from "../../qa/shared";
import { Toggle } from "../../../components/ui/EmailNotificationSettings";
import { BRAND, FONT, card, pill } from "../../../theme/brand";
import { useSaveMyEducatorProfile } from "../hooks/useEducatorProfile";
import { publicProfileUrl } from "../services/educatorProfileApi";
import PublicProfileView from "./PublicProfileView";

// The educator's public profile, as they manage it (teacher portal → My profile → Public profile):
// where it stands (three steps: write it → an admin checks it → published), the form on the left —
// what they write about themself and the switch to share it — and on the right a live card of how
// families see it, and the link + QR once published. Their figures, badges and ratings come from
// their teaching — never typed in.

export const OWN_STATE = {
  private: { label: "Private", tone: "neutral", text: "Only you, your supervisor and the admins see your profile." },
  pending: { label: "Waiting for approval", tone: "waiting", text: "You've chosen to share it. An admin checks it, then it goes public." },
  published: { label: "Published", tone: "good", text: "Live. Share the link, and families also find you in their portal." },
  changes: { label: "Changes waiting", tone: "info", text: "Published. Your latest changes go live once an admin checks them." },
};
const list = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);

// Write it → an admin checks it → published, with where they are now.
function Steps({ state }) {
  // The step they're on: writing it (private), with an admin (pending / changes waiting), or all done.
  const at = state === "published" ? 3 : state === "pending" || state === "changes" ? 1 : 0;
  const steps = [
    { icon: FiEdit3, label: "Write it" },
    { icon: FiSend, label: "An admin checks it" },
    { icon: FiGlobe, label: "Published" },
  ];
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {steps.map((st, i) => {
        const done = i < at;
        const now = i === at;
        const color = done ? BRAND.mid : now ? BRAND.gold : BRAND.border;
        return (
          <li key={st.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", background: done ? BRAND.mid : now ? BRAND.goldTint : BRAND.surface, color: done ? "#fff" : now ? BRAND.goldText : BRAND.faint, border: `2px solid ${color}`, flexShrink: 0 }}>
              {done ? <FiCheck size={14} /> : <st.icon size={13} />}
            </span>
            <span style={{ fontSize: 13, fontWeight: now || done ? 800 : 600, color: now || done ? BRAND.ink : BRAND.muted }}>{st.label}</span>
            {i < steps.length - 1 && <span aria-hidden style={{ width: 28, height: 2, borderRadius: 2, background: done ? BRAND.mid : BRAND.border }} />}
          </li>
        );
      })}
    </ol>
  );
}

// How families see it — a short card from what's typed, live.
function LiveCard({ preview, about, photo }) {
  const p = { ...preview, ...about };
  const initials = String(p.name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const chips = [p.ageRange && `Ages ${p.ageRange}`, ...(p.specialties || []).slice(0, 4), ...(p.languages || []).slice(0, 2)].filter(Boolean);
  const earned = (p.badges || []).length;
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div style={{ height: 54, background: "linear-gradient(135deg, #1a3550, #2e7db5 70%, #38aae1)" }} />
      <div style={{ padding: "0 18px 18px", marginTop: -28 }}>
        {photo || p.photo ? (
          <img src={photo || p.photo} alt="" style={{ width: 60, height: 60, borderRadius: 999, objectFit: "cover", border: "3px solid #fff" }} />
        ) : (
          <span style={{ width: 60, height: 60, borderRadius: 999, border: "3px solid #fff", background: BRAND.navy, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20 }}>{initials}</span>
        )}
        <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 900, color: BRAND.ink }}>{p.name}</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: p.headline ? BRAND.inkSoft : BRAND.faint }}>{p.headline || "Your headline"}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "10px 0", fontSize: 12.5, color: BRAND.muted }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiStar size={13} color={BRAND.gold} /> {p.rating?.average != null ? `${Number(p.rating.average).toFixed(1)} · ${p.rating.count}` : "New"}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiUsers size={13} /> {p.learnersTaught || 0} learners</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiAward size={13} /> {earned} badge{earned === 1 ? "" : "s"}</span>
        </div>
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {chips.map((c) => <span key={c} style={pill("info")}>{c}</span>)}
          </div>
        )}
        <p style={{ margin: 0, fontSize: 13, color: p.bio ? BRAND.inkSoft : BRAND.faint, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {p.bio || "Your introduction shows here."}
        </p>
      </div>
    </div>
  );
}

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

  const state = profile.publish.state;
  const look = OWN_STATE[state];
  const url = profile.publish.slug ? publicProfileUrl(profile.publish.slug) : null;
  const about = { headline: form.headline, bio: form.bio, specialties: list(form.specialties), languages: list(form.languages), ageRange: form.ageRange };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ } };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%", fontFamily: FONT }}>
      <CheckinStyles />
      {/* Where it stands */}
      <section style={{ ...card, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <Steps state={state} />
        <span style={pill(look.tone)}>{look.label}</span>
        {profile.publish.reviewNote && state !== "published" && (
          <p style={{ flex: "1 1 100%", margin: 0, padding: "9px 12px", borderRadius: 10, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, color: BRAND.goldText, fontSize: 12.5 }}>An admin asked: &ldquo;{profile.publish.reviewNote}&rdquo;</p>
        )}
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        {/* The form */}
        <section style={{ ...card, flex: "1 1 460px", minWidth: 0, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: BRAND.ink, display: "flex", alignItems: "center", gap: 8 }}><FiEdit3 color={BRAND.mid} /> About you</h2>
          <div>
            <label htmlFor="ep-headline" style={label}>Headline</label>
            <input id="ep-headline" value={form.headline} onChange={set("headline")} maxLength={120} placeholder="e.g. Robotics & coding mentor for ages 8–14" style={input} />
          </div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}>
            <div>
              <label htmlFor="ep-ages" style={label}>Ages you teach</label>
              <input id="ep-ages" value={form.ageRange} onChange={set("ageRange")} maxLength={30} placeholder="e.g. 8–14" style={input} />
            </div>
            <div>
              <label htmlFor="ep-lang" style={label}>Languages</label>
              <input id="ep-lang" value={form.languages} onChange={set("languages")} placeholder="English, Kiswahili" style={input} />
            </div>
          </div>
          <div>
            <label htmlFor="ep-spec" style={label}>What you teach best</label>
            <input id="ep-spec" value={form.specialties} onChange={set("specialties")} placeholder="Scratch, Robotics, Python" style={input} />
            <p style={hint}>Separate with commas, up to 8.</p>
          </div>
          <div>
            <label htmlFor="ep-bio" style={label}>Introduce yourself</label>
            <textarea id="ep-bio" value={form.bio} onChange={set("bio")} rows={5} maxLength={1500} placeholder="How you teach, what learners enjoy in your sessions, your background…" style={{ ...input, resize: "vertical", lineHeight: 1.55 }} />
            <p style={{ ...hint, textAlign: "right" }}>{form.bio.length}/1500</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: optIn ? BRAND.skyTint : BRAND.canvas, border: `1.5px solid ${optIn ? BRAND.skyBorder : BRAND.line}` }}>
            <Toggle checked={optIn} onChange={setOptIn} label="Share my profile" />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>Share my profile</p>
              <p title="Never shown: your contact details, pay, quality-review scores, or anything a parent didn't agree to share. Switch it off any time to take it down." style={{ margin: "1px 0 0", fontSize: 12, color: BRAND.muted, cursor: "help" }}>
                An admin checks it first. Contact details, pay and scores are never shown.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="ci-btn" disabled={save.isPending} onClick={() => save.mutate({ about, optIn })} style={btn("primary", { disabled: save.isPending })}>{save.isPending ? "Saving…" : "Save"}</button>
            <button type="button" className="ci-btn" onClick={() => setPreview(true)} style={btn("secondary")}><FiEye size={14} style={{ marginRight: 6 }} /> Full preview</button>
          </div>
        </section>

        {/* How families see it, and the link */}
        <div style={{ flex: "1 1 300px", maxWidth: 420, minWidth: 0, display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: BRAND.sky }}>How families see you</p>
            <LiveCard preview={profile.preview || {}} about={about} photo={profile.teacher?.photo} />
          </div>
          <section style={{ ...card, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>Your link</p>
            {profile.publish.public && url ? (
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ padding: 6, background: BRAND.surface, borderRadius: 10, border: `1px solid ${BRAND.line}` }}><QRCodeCanvas value={url} size={80} fgColor={BRAND.navy} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: "1 1 160px" }}>
                  <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: BRAND.mid, overflowWrap: "anywhere", fontWeight: 600 }}>{url} <FiExternalLink size={11} /></a>
                  <button type="button" className="ci-btn" onClick={copy} style={{ ...btn("secondary", { size: "sm" }), alignSelf: "flex-start" }}>{copied ? <><FiCheck size={12} style={{ marginRight: 4 }} /> Copied</> : <><FiCopy size={12} style={{ marginRight: 4 }} /> Copy link</>}</button>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted, display: "flex", alignItems: "center", gap: 6 }}><FiLock size={13} /> Ready once it&apos;s published.</p>
            )}
          </section>
        </div>
      </div>

      {preview && (
        <Modal title="How families will see your profile" onClose={() => setPreview(false)} width={980}>
          <PublicProfileView profile={{ ...profile.preview, ...about }} note={<p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>A preview with what you&apos;ve typed. Save it, and it goes public once an admin checks it.</p>} />
        </Modal>
      )}
    </div>
  );
}
