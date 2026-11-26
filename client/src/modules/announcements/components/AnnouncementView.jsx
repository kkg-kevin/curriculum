import { useState } from "react";
import { FiAward, FiCheckCircle, FiExternalLink, FiHeart, FiPaperclip, FiSend, FiSmile, FiThumbsUp, FiTrash2, FiVolume2, FiZap, FiMessageSquare } from "react-icons/fi";
import { BRAND, FONT, card, pill } from "../../../theme/brand";
import RichContent from "../../assessments/components/RichContent";
import { day, when } from "../services/announcementsApi";
import { useWide } from "./ui";

// One announcement as the people it reached see it (and as the team previews it). Laid out like a
// letter: who it's from, the title, the message, its button and file; then a clear "please confirm"
// card when the team asked for one; a compact reaction bar; and the group's own comments.
// Shared by every portal's Announcements page and the composer's live preview (`preview` = nothing
// can be clicked).

export const REACTIONS = {
  like: { Icon: FiThumbsUp, label: "Like" },
  love: { Icon: FiHeart, label: "Love" },
  celebrate: { Icon: FiAward, label: "Celebrate" },
  idea: { Icon: FiZap, label: "Great idea" },
  thanks: { Icon: FiSmile, label: "Thanks" },
};

const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function AnnouncementBody({ a }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {a.imageUrl && <img src={a.imageUrl} alt="" style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 14, border: `1px solid ${BRAND.line}` }} />}
      {a.body && <div style={{ fontSize: 15 }}><RichContent html={a.body} emptyText="" /></div>}
      {(a.linkUrl || a.fileUrl) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {a.linkUrl && (
            <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "10px 18px", borderRadius: 12, background: BRAND.navy, color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
              {a.linkLabel || "Open"} <FiExternalLink size={14} />
            </a>
          )}
          {a.fileUrl && (
            <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 44, padding: "8px 14px", borderRadius: 12, border: `1.5px solid ${BRAND.border}`, background: "#fff", color: BRAND.ink, fontWeight: 700, fontSize: 13.5, textDecoration: "none", maxWidth: "100%" }}>
              <span aria-hidden style={{ width: 30, height: 30, borderRadius: 8, background: BRAND.skyTint, color: BRAND.navy, display: "grid", placeItems: "center", flexShrink: 0 }}><FiPaperclip size={14} /></span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName || "File"}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnnouncementView({ a, preview = false, busy = false, onAck, onReact, onComment, onDeleteComment }) {
  const [text, setText] = useState("");
  const showLabels = useWide(700);
  const comments = a.comments || [];
  const live = a.state === "live" || preview;
  const send = () => { if (text.trim()) { onComment?.(text.trim()); setText(""); } };
  const totalReactions = Object.values(a.reactions || {}).reduce((n, v) => n + (v || 0), 0);

  return (
    <article style={{ ...card, padding: 0, overflow: "hidden", fontFamily: FONT }}>
      <div style={{ padding: "18px 20px", display: "grid", gap: 16 }}>
        <header style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span aria-hidden style={{ width: 42, height: 42, borderRadius: 12, background: BRAND.navy, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><FiVolume2 size={19} /></span>
          <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, color: BRAND.muted }}>
              <strong style={{ color: BRAND.inkSoft }}>{a.authorName || "Digifunzi team"}</strong>{a.publishedAt ? ` · ${when(a.publishedAt)}` : ""}
            </span>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: BRAND.ink, lineHeight: 1.25, overflowWrap: "anywhere" }}>{a.title || "Your title"}</h2>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {a.important && <span style={pill("waiting")}>Important</span>}
              {a.pinned && <span style={pill("info")}>Pinned</span>}
              {!live && <span style={pill("neutral")}>Ended</span>}
              {a.endsAt && live && <span style={pill("neutral")}>Until {day(a.endsAt)}</span>}
            </span>
          </div>
        </header>

        <AnnouncementBody a={a} />

        {/* The team asked them to confirm: a card of its own, so it can't be missed. */}
        {a.askAck && (
          a.acked ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 14, background: BRAND.skyTint, border: `1px solid ${BRAND.skyBorder}`, color: BRAND.navy, fontWeight: 800, fontSize: 14 }}>
              <FiCheckCircle size={18} /> You confirmed you&apos;ve read this. Thank you.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", borderRadius: 14, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}` }}>
              <span style={{ flex: "1 1 220px", fontSize: 14, color: BRAND.goldText, fontWeight: 700 }}>The team asked everyone to confirm they&apos;ve read this.</span>
              <button type="button" disabled={preview || busy || !a.can?.ack} onClick={onAck} style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "10px 18px", borderRadius: 12, border: "none", background: BRAND.navy, color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: FONT, cursor: preview ? "default" : "pointer" }}>
                <FiCheckCircle /> I&apos;ve read this
              </button>
            </div>
          )
        )}
      </div>

      {(a.allowReactions || a.allowComments) && (
        <footer style={{ borderTop: `1px solid ${BRAND.line}`, background: BRAND.canvas, padding: "12px 20px 16px", display: "grid", gap: 12 }}>
          {a.allowReactions && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }} aria-label="Reactions">
              {Object.entries(REACTIONS).map(([kind, { Icon, label }]) => {
                const on = a.myReaction === kind;
                const n = a.reactions?.[kind] || 0;
                return (
                  <button key={kind} type="button" aria-pressed={on} aria-label={`${label}${n ? `, ${n}` : ""}`} title={label} disabled={preview || busy || !a.can?.react} onClick={() => onReact?.(on ? null : kind)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 38, minWidth: 44, justifyContent: "center", padding: "6px 11px", borderRadius: 999, border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.inkSoft, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: preview ? "default" : "pointer" }}>
                    <Icon size={15} />{showLabels && <span>{label}</span>}{n > 0 && <strong>{n}</strong>}
                  </button>
                );
              })}
              {totalReactions > 0 && !showLabels && <span style={{ fontSize: 12, color: BRAND.muted, marginLeft: 4 }}>{totalReactions} {totalReactions === 1 ? "reaction" : "reactions"}</span>}
            </div>
          )}

          {a.allowComments && (
            <section style={{ display: "grid", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: BRAND.ink, display: "flex", gap: 7, alignItems: "center" }}><FiMessageSquare size={15} /> Comments{comments.length ? ` · ${comments.length}` : ""}</h3>
              {preview && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>Each group comments in its own thread: parents only see parents&apos;, educators only educators&apos;, learners only learners&apos;.</p>}
              {!preview && !comments.length && live && <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>No comments yet. Be the first.</p>}
              {comments.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span aria-hidden style={{ width: 32, height: 32, borderRadius: "50%", background: c.fromTeam ? BRAND.navy : BRAND.skyTint, color: c.fromTeam ? "#fff" : BRAND.navy, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>{c.fromTeam ? <FiVolume2 size={14} /> : initials(c.authorName)}</span>
                  <div style={{ flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: "4px 14px 14px 14px", background: "#fff", border: `1px solid ${c.fromTeam ? BRAND.navyBorder : BRAND.line}` }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 13, color: BRAND.ink }}>{c.authorName}</strong>
                          {c.fromTeam ? <span style={pill("strong", { fontSize: 10.5, padding: "1px 7px" })}>Digifunzi team</span> : c.authorRole && <span style={{ fontSize: 11.5, color: BRAND.muted }}>{c.authorRole}</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: BRAND.faint }}>{when(c.createdAt)}</div>
                      </div>
                      {c.mine && onDeleteComment && <button type="button" aria-label="Delete my comment" title="Delete" onClick={() => onDeleteComment(c.id)} style={{ border: "none", background: "none", color: BRAND.faint, cursor: "pointer", width: 32, height: 32, display: "grid", placeItems: "center", flexShrink: 0, marginTop: -4 }}><FiTrash2 size={14} /></button>}
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 14, color: BRAND.inkSoft, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>{c.body}</p>
                  </div>
                </div>
              ))}
              {a.can?.comment && !preview ? (
                <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea aria-label="Write a comment" rows={1} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && showLabels) { e.preventDefault(); send(); } }}
                    placeholder="Write a comment…" style={{ flex: 1, minWidth: 0, minHeight: 44, maxHeight: 160, padding: "11px 14px", borderRadius: 14, border: `1.5px solid ${BRAND.border}`, fontSize: 16, fontFamily: FONT, resize: "vertical", boxSizing: "border-box", background: "#fff" }} />
                  <button type="submit" aria-label="Send comment" disabled={busy || !text.trim()} style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: text.trim() ? BRAND.navy : BRAND.border, color: "#fff", display: "grid", placeItems: "center", cursor: text.trim() ? "pointer" : "default", flexShrink: 0 }}><FiSend size={17} /></button>
                </form>
              ) : !preview && !live ? <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>Comments are closed: this announcement has ended.</p> : null}
            </section>
          )}
        </footer>
      )}
    </article>
  );
}
