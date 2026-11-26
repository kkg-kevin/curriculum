import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiArrowLeft, FiEdit3, FiExternalLink, FiHeart, FiMessageCircle, FiMessageSquare, FiPaperclip, FiShield, FiSlash, FiTool, FiUsers } from "react-icons/fi";
import { askConfirm } from "../../../components/ui/AskDialog";
import { connectApi } from "../services/connectApi";
import { HERO_GRADIENT } from "../../../theme/brand";
import { C, FONT, card, btn, pill, ErrorBox, Loading, MemberAvatar, timeAgo, errorOf, ConnectStyles, ScrollRow, useNarrow } from "../components/kit";

// A parent's Digifunzi Connect page for one child (/parent/children/:childId/connect).
// 26 Nov 2026 (the user's choice): every learner is on Connect automatically — no parent's switch,
// no age limit — and the parent sees EVERYTHING their child does there: their posts, comments and
// reactions with what they said, every chat with every message, who they're connected with, their
// communities and projects. The parent can still switch messages with other learners off and
// block someone (the child can't undo a parent's block).

const when = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const KIND = { project: ["waiting", "Project team"], group: ["info", "Group"], direct: ["strong", "One-to-one"] };
const REACTION_WORD = { like: "Liked", love: "Loved", wow: "Was amazed by", idea: "Found a great idea in", clap: "Clapped for" };

function Files({ files }) {
  if (!files?.length) return null;
  const images = files.filter((f) => f.kind === "image" || /^image\//.test(f.mimeType || ""));
  const others = files.filter((f) => !images.includes(f));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {images.length > 0 && (
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
          {images.map((f) => <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"><img src={f.url} alt={f.filename || ""} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.line}` }} /></a>)}
        </div>
      )}
      {others.map((f) => <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontWeight: 700, color: C.navy }}><FiPaperclip /> {f.filename || "File"}</a>)}
    </div>
  );
}

function StatusPill({ status, removedReason }) {
  if (status === "removed") return <span style={pill("danger")} title={removedReason || ""}>Taken down by a moderator{removedReason ? `: ${removedReason}` : ""}</span>;
  if (status === "pending") return <span style={pill("waiting")}>Waiting for a check</span>;
  return null;
}

function Posts({ a, child }) {
  if (!a.posts.length) return <Empty text={`${child.firstName} hasn't posted anything yet.`} />;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {a.posts.map((p) => (
        <article key={p.id} style={{ ...card, display: "grid", gap: 8, opacity: p.status === "removed" ? 0.75 : 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: C.muted }}>
            <span style={pill("strong")}>{p.where}</span>
            <span>{when(p.createdAt)}{p.editedAt ? " · edited" : ""}</span>
            <StatusPill status={p.status} removedReason={p.removedReason} />
          </div>
          {p.body && <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.55 }}>{p.body}</p>}
          {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontWeight: 700, color: C.navy, wordBreak: "break-all" }}><FiExternalLink /> {p.link}</a>}
          <Files files={p.files} />
          <div style={{ fontSize: 12.5, color: C.muted }}>{p.reactionCount} reaction{p.reactionCount === 1 ? "" : "s"} · {p.commentCount} comment{p.commentCount === 1 ? "" : "s"}</div>
        </article>
      ))}
    </div>
  );
}

function PostRef({ post }) {
  if (!post) return <span style={{ color: C.muted }}>a post that has since been deleted</span>;
  return <span><strong>{post.mine ? "their own" : `${post.by}'s`}</strong> post in {post.where}{post.snippet ? <>: <em style={{ color: C.inkSoft }}>“{post.snippet}{post.snippet.length >= 140 ? "…" : ""}”</em></> : ""}</span>;
}

function Comments({ a, child }) {
  if (!a.comments.length && !a.reactions.length) return <Empty text={`${child.firstName} hasn't commented on or reacted to anything yet.`} />;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {a.comments.map((c) => (
        <div key={c.id} style={{ ...card, display: "grid", gap: 6, opacity: c.status === "removed" ? 0.75 : 1 }}>
          <div style={{ fontSize: 12.5, color: C.muted, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><FiMessageSquare /> Commented on <PostRef post={c.post} /> · {when(c.createdAt)} <StatusPill status={c.status} /></div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.body}</p>
        </div>
      ))}
      {a.reactions.length > 0 && (
        <section style={{ ...card, display: "grid", gap: 6 }}>
          <h4 style={{ margin: 0, fontSize: 14.5, display: "flex", gap: 6, alignItems: "center" }}><FiHeart /> Reactions</h4>
          {a.reactions.map((r, i) => <div key={i} style={{ fontSize: 13.5, color: C.inkSoft, padding: "4px 0", borderBottom: `1px solid ${C.line}` }}>{REACTION_WORD[r.kind] || "Reacted to"} <PostRef post={r.post} /> <span style={{ color: C.muted }}>· {timeAgo(r.createdAt)}</span></div>)}
        </section>
      )}
    </div>
  );
}

function Chat({ child, conversationId, onBack, onBlock, blockedIds }) {
  const q = useQuery({ queryKey: ["connect", "parent", "chat", child.id, conversationId], queryFn: () => connectApi.parent.conversation(child.id, conversationId) });
  if (q.isLoading) return <Loading rows={2} />;
  if (q.error) return <ErrorBox error={q.error} />;
  const c = q.data;
  const [tone, label] = KIND[c.kind] || KIND.direct;
  return (
    <section style={{ ...card, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={onBack} style={btn("ghost")}><FiArrowLeft /> All chats</button>
        <span style={pill(tone)}>{label}</span>
        <strong style={{ flex: 1, minWidth: 0 }}>{c.kind === "direct" ? c.with[0]?.displayName : c.title || c.with.map((w) => w.displayName).join(", ")}</strong>
        {c.kind !== "project" && c.with.filter((w) => !blockedIds.has(w.id)).map((w) => <button key={w.id} type="button" style={btn("link", { color: C.danger })} onClick={() => onBlock(w)}><FiSlash /> Block {w.displayName}</button>)}
      </div>
      {!c.messages.length && <p style={{ margin: 0, color: C.muted }}>No messages yet.</p>}
      <div style={{ display: "grid", gap: 8, maxHeight: "65vh", overflowY: "auto", padding: 4 }}>
        {c.messages.map((m) => (
          <div key={m.id} style={{ display: "flex", gap: 8, justifyContent: m.fromChild ? "flex-end" : "flex-start", alignItems: "flex-end" }}>
            {!m.fromChild && <MemberAvatar card={m.sender} size={28} />}
            <div style={{ maxWidth: "78%", padding: "8px 12px", borderRadius: 14, background: m.fromChild ? C.navy : C.canvas, color: m.fromChild ? "#fff" : C.ink, border: m.fromChild ? "none" : `1px solid ${C.line}` }}>
              <div style={{ fontSize: 11.5, opacity: 0.8, marginBottom: 2 }}>{m.fromChild ? child.firstName : m.sender?.displayName || "Someone"} · {when(m.createdAt)}</div>
              {m.removed ? <em style={{ opacity: 0.75 }}>Removed{m.removedBy === "moderator" ? " by a moderator" : ""}</em> : m.body && <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.45 }}>{m.body}</div>}
              <Files files={m.files} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Chats({ a, child, onBlock, blockedIds }) {
  const [open, setOpen] = useState(null);
  if (open) return <Chat child={child} conversationId={open} onBack={() => setOpen(null)} onBlock={onBlock} blockedIds={blockedIds} />;
  if (!a.conversations.length) return <Empty text={`${child.firstName} hasn't chatted with anyone yet.`} />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {a.conversations.map((c) => {
        const [tone, label] = KIND[c.kind] || KIND.direct;
        return (
          <button key={c.id} type="button" onClick={() => setOpen(c.id)} style={{ ...card, textAlign: "left", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", fontFamily: FONT }}>
            <MemberAvatar card={c.with[0]} size={38} />
            <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={pill(tone)}>{label}</span>
                <strong>{c.kind === "direct" ? c.with[0]?.displayName : c.title || c.with.map((w) => w.displayName).join(", ")}</strong>
              </span>
              <span style={{ fontSize: 12.5, color: C.muted }}>{c.with.length} other{c.with.length === 1 ? "" : "s"} · {c.sentByChild} sent by {child.firstName} · last message {c.lastMessageAt ? timeAgo(c.lastMessageAt) : "none yet"}</span>
            </span>
            <span style={btn("soft")}>Read</span>
          </button>
        );
      })}
    </div>
  );
}

function People({ a, child, onBlock, onUnblock, blockedIds }) {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", alignItems: "start" }}>
      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16, display: "flex", gap: 6, alignItems: "center" }}><FiUsers /> Connected with</h3>
        {a.connections.length ? a.connections.map((c) => (
          <div key={c.member?.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
            <MemberAvatar card={c.member} size={32} />
            <span style={{ flex: 1, minWidth: 0 }}><strong>{c.member?.displayName}</strong><span style={{ display: "block", fontSize: 12, color: C.muted }}>since {new Date(c.since).toLocaleDateString("en-GB")}</span></span>
            {c.member?.id && !blockedIds.has(c.member.id) && <button type="button" style={btn("link", { color: C.danger })} onClick={() => onBlock(c.member)}><FiSlash /> Block</button>}
          </div>
        )) : <p style={{ color: C.muted, margin: 0 }}>No connections yet.</p>}
      </section>
      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16, display: "flex", gap: 6, alignItems: "center" }}><FiSlash /> Blocked and muted</h3>
        {a.blocks.length ? a.blocks.map((b) => (
          <div key={`${b.kind}${b.member?.id}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", flexWrap: "wrap" }}>
            <MemberAvatar card={b.member} size={28} /><span style={{ flex: 1 }}>{b.member?.displayName}</span>
            <span style={pill(b.kind === "block" ? "danger" : "neutral")}>{b.kind === "block" ? "Blocked" : "Muted"}{b.byParent ? " by you" : ` by ${child.firstName}`}</span>
            {b.byParent && <button type="button" style={btn("link")} onClick={() => onUnblock(b.member.id)}>Unblock</button>}
          </div>
        )) : <p style={{ color: C.muted, margin: 0 }}>Nobody blocked.</p>}
      </section>
    </div>
  );
}

function Groups({ a, child }) {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", alignItems: "start" }}>
      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Communities</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{a.communities.map((c) => <span key={c.slug} style={pill("strong")}>{c.name}</span>)}</div>
        {!a.communities.length && <p style={{ color: C.muted, margin: 0 }}>{child.firstName} hasn&apos;t joined a community yet.</p>}
      </section>
      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16, display: "flex", gap: 6, alignItems: "center" }}><FiTool /> Projects</h3>
        {a.projects.map((p) => <div key={p.id} style={{ padding: "6px 0", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong style={{ flex: 1 }}>{p.title}</strong><span style={pill("neutral")}>{p.role === "owner" ? "Leads it" : "Team member"}</span><span style={pill("info")}>{p.status}</span></div>)}
        {!a.projects.length && <p style={{ color: C.muted, margin: 0 }}>No projects yet.</p>}
      </section>
    </div>
  );
}

const Empty = ({ text }) => <div style={{ ...card, textAlign: "center", color: C.muted, padding: "28px 18px" }}>{text}</div>;

export default function ParentConnectPage() {
  const { child } = useOutletContext();
  const qc = useQueryClient();
  const narrow = useNarrow(640);
  const [tab, setTab] = useState("posts");
  const list = useQuery({ queryKey: ["connect", "parent", "children"], queryFn: connectApi.parent.children });
  const me = list.data?.find((c) => c.learnerId === child.id);
  const on = me?.status === "active" || me?.status === "suspended";
  const activity = useQuery({ queryKey: ["connect", "parent", "activity", child.id], queryFn: () => connectApi.parent.activity(child.id), enabled: on });
  const refresh = () => qc.invalidateQueries({ queryKey: ["connect", "parent"] });
  const switches = useMutation({ mutationFn: (body) => connectApi.parent.switches(child.id, body), onSuccess: () => { toast.success("Saved"); refresh(); }, onError: (e) => toast.error(errorOf(e)) });
  const unblock = async (memberId) => { try { await connectApi.parent.unblock(child.id, memberId); toast.success("Unblocked"); refresh(); } catch (e) { toast.error(errorOf(e)); } };
  const block = async (m) => {
    if (!(await askConfirm({ title: `Block ${m.displayName} for ${child.firstName}?`, message: `They won't be able to message ${child.firstName}, and they won't see each other's posts. ${child.firstName} can't undo it, only you can.`, confirmLabel: "Block", tone: "danger" }))) return;
    try { await connectApi.parent.block(child.id, m.id); toast.success("Blocked"); refresh(); } catch (e) { toast.error(errorOf(e)); }
  };

  if (list.isLoading) return <Loading rows={2} />;
  if (list.error) return <ErrorBox error={list.error} />;
  if (!me) return <p>Connect isn&apos;t available for this child.</p>;
  const a = activity.data;
  const blockedIds = new Set((a?.blocks || []).filter((b) => b.kind === "block").map((b) => b.member?.id));
  const TABS = a ? [
    ["posts", "Posts", FiEdit3, a.posts.length],
    ["comments", "Comments and reactions", FiMessageSquare, a.comments.length + a.reactions.length],
    ["chats", "Chats", FiMessageCircle, a.conversations.length],
    ["people", "People", FiUsers, a.connections.length],
    ["groups", "Communities and projects", FiTool, a.communities.length + a.projects.length],
  ] : [];

  return (
    <div className="cx" style={{ fontFamily: FONT, color: C.ink, display: "grid", gap: narrow ? 10 : 14, width: "100%" }}>
      <ConnectStyles />
      <header style={{ background: HERO_GRADIENT, color: "#fff", borderRadius: narrow ? 16 : 20, padding: narrow ? "14px 16px" : "18px 22px" }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold }}>Digifunzi Connect</div>
        <h1 style={{ margin: "4px 0 4px", fontSize: 22 }}>{child.firstName}&apos;s learning community</h1>
        <div style={{ opacity: 0.92, lineHeight: 1.5, fontSize: narrow ? 13.5 : 14.5 }}>
          Learners share what they make, ask for help, join interest groups, team up on projects and take on challenges.
          You can see everything {child.firstName} posts, comments and says in chats.
        </div>
      </header>

      {!on ? (
        <section style={{ ...card, lineHeight: 1.6 }}>
          {!me.hasLogin
            ? <>Connect is used from {child.firstName}&apos;s own login. Set one up on their <strong>Login</strong> page and they&apos;re on Connect straight away.</>
            : `${child.firstName} joins Connect once they're at a Digifunzi learning hub.`}
        </section>
      ) : (
        <>
          <section style={{ ...card, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={pill("good")}><FiShield size={12} /> On Connect</span>
              {me.status === "suspended" && <span style={pill("waiting")}>Posting paused by a moderator until {new Date(me.suspendedUntil).toLocaleDateString("en-GB")}</span>}
              <span style={{ color: C.muted, fontSize: 13.5 }}>Others see “{me.displayName}”, never {child.firstName}&apos;s surname, school, class or age.</span>
            </div>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 600 }}>
              <input type="checkbox" checked={me.directMessages} disabled={switches.isPending} onChange={(e) => switches.mutate({ directMessages: e.target.checked })} style={{ marginTop: 4, width: 20, height: 20 }} />
              <span>Allow one-to-one and group messages with learners {child.firstName} is connected with
                <span style={{ display: "block", fontSize: 13, color: C.muted, fontWeight: 400 }}>Project team chats stay on either way. You can read every message below.</span>
              </span>
            </label>
          </section>

          {activity.isLoading ? <Loading rows={2} /> : activity.error ? <ErrorBox error={activity.error} /> : (
            <>
              <ScrollRow aria-label="What to see" activeKey={tab}>
                {TABS.map(([key, text, Icon, n]) => (
                  <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)} style={{ ...btn(tab === key ? "primary" : "ghost"), borderRadius: 999, minHeight: 40, flexShrink: 0 }}>
                    <Icon /> {text}{n > 0 && <span style={{ background: tab === key ? "rgba(255,255,255,0.22)" : C.greyTint, borderRadius: 999, padding: "0 7px", fontSize: 12 }}>{n}</span>}
                  </button>
                ))}
              </ScrollRow>
              {tab === "posts" && <Posts a={a} child={child} />}
              {tab === "comments" && <Comments a={a} child={child} />}
              {tab === "chats" && <Chats a={a} child={child} onBlock={block} blockedIds={blockedIds} />}
              {tab === "people" && <People a={a} child={child} onBlock={block} onUnblock={unblock} blockedIds={blockedIds} />}
              {tab === "groups" && <Groups a={a} child={child} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
