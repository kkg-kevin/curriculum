import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiPlus, FiSend, FiBellOff, FiBell, FiLogOut, FiTool, FiUsers, FiArrowLeft, FiInfo } from "react-icons/fi";
import { askConfirm } from "../../../components/ui/AskDialog";
import { connectApi } from "../services/connectApi";
import { C, FONT, card, btn, pill, input, label, Empty, ErrorBox, Loading, MemberAvatar, FileGallery, FilePickerButton, ReportDialog, MoreMenu, PlainText, Modal, timeAgo, errorOf, useNarrow } from "../components/kit";
import { CONNECT_BASE } from "./ConnectLayout";

const base = `${CONNECT_BASE}/messages`;
const POLL_MS = 4000;

// Messages: the list of chats beside the open one (one at a time on phones). The page asks for new
// messages every few seconds while a chat is open.
export default function MessagesPage() {
  const { me } = useOutletContext();
  const { conversationId } = useParams();
  const narrow = useNarrow(820);
  const [starting, setStarting] = useState(false);
  const list = useQuery({ queryKey: ["connect", "conversations"], queryFn: connectApi.conversations, refetchInterval: 15000 });

  const listPane = (
    <div style={{ ...card, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: narrow ? 0 : 520 }}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${C.line}` }}>
        <h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>Chats</h2>
        <button type="button" style={btn("primary", { padding: "7px 12px" })} onClick={() => setStarting(true)}><FiPlus /> New</button>
      </div>
      {list.isLoading ? <div style={{ padding: 16 }}><Loading rows={2} /></div> : list.error ? <ErrorBox error={list.error} /> : (
        <div style={{ overflowY: "auto", flex: 1 }}>
          {list.data.map((cv) => (
            <Link key={cv.id} to={`${base}/${cv.id}`} style={{ display: "flex", gap: 10, padding: "12px 16px", textDecoration: "none", color: C.ink, borderBottom: `1px solid ${C.line}`, background: cv.id === conversationId ? C.skyTint : "transparent" }}>
              {cv.kind === "direct" ? <MemberAvatar card={cv.people[0]} size={40} /> : <span style={{ width: 40, height: 40, borderRadius: 12, background: cv.kind === "project" ? C.gold : C.mid, color: cv.kind === "project" ? C.navyDeep : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cv.kind === "project" ? <FiTool /> : <FiUsers />}</span>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <strong style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cv.title}</strong>
                  {cv.muted && <FiBellOff size={13} color={C.faint} />}
                  <span style={{ fontSize: 11.5, color: C.muted }}>{cv.lastMessage ? timeAgo(cv.lastMessage.at) : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: cv.unread ? C.ink : C.muted, fontWeight: cv.unread ? 800 : 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cv.lastMessage ? `${cv.lastMessage.mine ? "You: " : ""}${cv.lastMessage.preview}` : cv.kind === "project" ? "Your project team's chat" : "Say hello!"}
                  </span>
                  {cv.unread > 0 && <span style={{ background: C.gold, color: C.navyDeep, borderRadius: 999, fontSize: 11.5, fontWeight: 900, padding: "1px 7px" }}>{cv.unread}</span>}
                </div>
              </div>
            </Link>
          ))}
          {!list.data.length && (
            <div style={{ padding: 18, color: C.muted, lineHeight: 1.5 }}>
              No chats yet. Join a project team to chat with your teammates{me.canDirectMessage ? ", or message a connection" : ""}.
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "320px minmax(0, 1fr)", gap: 14 }}>
      {(!narrow || !conversationId) && listPane}
      {conversationId ? <Conversation key={conversationId} id={conversationId} me={me} narrow={narrow} />
        : !narrow && <Empty icon="link" title="Pick a chat">{me.canDirectMessage ? "Or start a new one with someone you're connected with." : `Chat with your project teams here. One-to-one messages open when you're ${me.rules?.dmMinAge}.`}</Empty>}
      <NewChatDialog open={starting} onClose={() => setStarting(false)} me={me} />
    </div>
  );
}

function Conversation({ id, me, narrow }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [header, setHeader] = useState(null);
  const [older, setOlder] = useState({ cursor: null, hasMore: false, loading: false });
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [reporting, setReporting] = useState(null);
  const endRef = useRef(null);
  const lastAt = useRef(null);

  const markRead = useCallback(() => {
    connectApi.markRead(id).then(() => { qc.invalidateQueries({ queryKey: ["connect", "counts"] }); qc.invalidateQueries({ queryKey: ["connect", "conversations"] }); }).catch(() => {});
  }, [id, qc]);

  useEffect(() => {
    let live = true;
    connectApi.messages(id).then((r) => {
      if (!live) return;
      setMessages(r.items);
      setHeader(r.conversation);
      setOlder({ cursor: r.nextCursor, hasMore: r.hasMore, loading: false });
      lastAt.current = r.items.at(-1)?.createdAt || new Date(0).toISOString();
      markRead();
      setTimeout(() => endRef.current?.scrollIntoView({ block: "end" }), 30);
    }).catch((e) => live && setError(e));
    const timer = setInterval(async () => {
      if (document.hidden || !lastAt.current) return;
      try {
        const r = await connectApi.messages(id, { after: lastAt.current });
        if (!live) return;
        setHeader(r.conversation);
        if (r.items.length) {
          setMessages((ms) => {
            const seen = new Set(ms.map((m) => m.id));
            return [...ms, ...r.items.filter((m) => !seen.has(m.id))];
          });
          lastAt.current = r.items.at(-1).createdAt;
          if (r.items.some((m) => !m.mine)) markRead();
          setTimeout(() => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 30);
        }
      } catch { /* the next tick tries again */ }
    }, POLL_MS);
    return () => { live = false; clearInterval(timer); };
  }, [id, markRead]);

  const loadOlder = async () => {
    setOlder((o) => ({ ...o, loading: true }));
    try {
      const r = await connectApi.messages(id, { before: older.cursor });
      setMessages((ms) => [...r.items, ...ms]);
      setOlder({ cursor: r.nextCursor, hasMore: r.hasMore, loading: false });
    } catch (e) { toast.error(errorOf(e)); setOlder((o) => ({ ...o, loading: false })); }
  };

  const send = useMutation({
    mutationFn: () => connectApi.send(id, { body: text.trim() || undefined, fileIds: files.map((f) => f.id) }),
    onSuccess: (m) => {
      setText(""); setFiles([]);
      setMessages((ms) => [...ms, m]);
      lastAt.current = m.createdAt;
      qc.invalidateQueries({ queryKey: ["connect", "conversations"] });
      setTimeout(() => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 30);
    },
    onError: (e) => toast.error(errorOf(e, "Couldn't send")),
  });
  const remove = async (m) => {
    if (!(await askConfirm({ title: "Remove this message?", message: "It will say the message was removed.", confirmLabel: "Remove", tone: "danger" }))) return;
    try { await connectApi.deleteMessage(m.id); setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, removed: true, removedBy: "sender", body: "", files: [] } : x))); } catch (e) { toast.error(errorOf(e)); }
  };
  const toggleMute = async () => { try { const r = await connectApi.muteConversation(id, !header.muted); setHeader((h) => ({ ...h, muted: r.muted })); qc.invalidateQueries({ queryKey: ["connect", "conversations"] }); } catch (e) { toast.error(errorOf(e)); } };
  const leave = async () => {
    if (!(await askConfirm({ title: "Leave this chat?", confirmLabel: "Leave" }))) return;
    try { await connectApi.leaveConversation(id); qc.invalidateQueries({ queryKey: ["connect", "conversations"] }); navigate(base); } catch (e) { toast.error(errorOf(e)); }
  };

  if (error) return <ErrorBox error={error} />;
  if (!header) return <Loading rows={2} />;
  // On a phone the open chat fills the screen, like a messaging app; the back arrow returns to the list.
  const frame = narrow
    // (top/left + size, never all four sides: the browser writes those as "inset: 0", which the
    // portal's phone styles (global.css) treat as one of its own dialogs and re-align)
    ? { position: "fixed", top: 0, left: 0, width: "100%", zIndex: 1400, borderRadius: 0, border: 0, height: "100dvh", padding: "0 0 env(safe-area-inset-bottom)" }
    : { height: 620 };
  const seenUpTo = header.seenUpTo ? new Date(header.seenUpTo) : null;
  const lastMine = [...messages].reverse().find((m) => m.mine && !m.removed);
  const blocker = header.sendBlocker;

  return (
    <section className="cx" style={{ ...card, padding: 0, display: "flex", flexDirection: "column", minHeight: 420, ...frame }} aria-label={`Chat: ${header.title}`}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${C.line}` }}>
        {narrow && <button type="button" aria-label="Back to chats" style={btn("link", { minWidth: 40, minHeight: 40, padding: 0 })} onClick={() => navigate(base)}><FiArrowLeft size={22} /></button>}
        {header.kind === "direct" ? <MemberAvatar card={header.people[0]} size={38} /> : <span style={{ width: 38, height: 38, borderRadius: 12, background: header.kind === "project" ? C.gold : C.mid, color: header.kind === "project" ? C.navyDeep : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{header.kind === "project" ? <FiTool /> : <FiUsers />}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900 }}>{header.kind === "direct" && header.people[0]?.id ? <Link to={`${CONNECT_BASE}/people/${header.people[0].id}`} style={{ color: C.ink }}>{header.title}</Link> : header.title}</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>{header.kind === "project" ? <Link to={`${CONNECT_BASE}/projects/${header.projectId}`} style={{ color: C.mid }}>Project team</Link> : header.kind === "group" ? header.people.map((p) => p.displayName).join(", ") : "One-to-one"}</div>
        </div>
        <button type="button" style={btn("link", { minWidth: 40, minHeight: 40, padding: 0 })} onClick={toggleMute} title={header.muted ? "Turn notifications on" : "Mute"} aria-label={header.muted ? "Unmute" : "Mute"}>{header.muted ? <FiBellOff size={18} /> : <FiBell size={18} />}</button>
        {header.kind === "group" && <button type="button" style={btn("link", { minWidth: 40, minHeight: 40, padding: 0 })} onClick={leave} aria-label="Leave chat"><FiLogOut size={18} /></button>}
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", background: C.canvas }}>
        {older.hasMore && <div style={{ textAlign: "center" }}><button type="button" style={btn("ghost")} disabled={older.loading} onClick={loadOlder}>{older.loading ? "Loading…" : "Older messages"}</button></div>}
        {!messages.length && <p style={{ textAlign: "center", color: C.muted }}>No messages yet. Say hello!</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showName = !m.mine && header.kind !== "direct" && prev?.sender?.id !== m.sender?.id;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: m.mine ? "row-reverse" : "row", gap: 8, marginTop: prev?.sender?.id === m.sender?.id ? 3 : 12, alignItems: "flex-end" }}>
              {!m.mine && <MemberAvatar card={m.sender} size={28} />}
              <div style={{ maxWidth: narrow ? "82%" : "75%", minWidth: 0 }}>
                {showName && <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, margin: "0 0 2px 4px" }}>{m.sender?.displayName}</div>}
                <div style={{ background: m.mine ? C.navy : "#fff", color: m.mine ? "#fff" : C.ink, border: m.mine ? 0 : `1px solid ${C.border}`, padding: "8px 12px", borderRadius: 16, borderBottomRightRadius: m.mine ? 4 : 16, borderBottomLeftRadius: m.mine ? 16 : 4 }}>
                  {m.removed ? <em style={{ opacity: 0.75 }}>{m.removedBy === "moderator" ? "Removed by a moderator" : "Message removed"}</em> : <>
                    {m.body && <PlainText style={{ fontSize: 14.5 }}>{m.body}</PlainText>}
                    <FileGallery files={m.files} compact />
                  </>}
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: m.mine ? "flex-end" : "flex-start", alignItems: "center", fontSize: 11, color: C.faint, marginTop: 2 }}>
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {m === lastMine && seenUpTo && new Date(m.createdAt) <= seenUpTo && <span>· Seen</span>}
                  {!m.removed && <MoreMenu items={[m.mine ? { label: "Remove", onClick: () => remove(m), danger: true } : { label: "Report", onClick: () => setReporting(m.id) }]} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {blocker ? (
        <div style={{ padding: 14, borderTop: `1px solid ${C.line}`, color: C.muted, display: "flex", gap: 8, alignItems: "center" }}><FiInfo /> {blocker}</div>
      ) : me.status !== "active" ? (
        <div style={{ padding: 14, borderTop: `1px solid ${C.line}`, color: C.muted }}>Messages are paused for you right now.</div>
      ) : (
        <div style={{ padding: 12, borderTop: `1px solid ${C.line}` }}>
          <FileGallery files={files} compact onRemove={(fid) => setFiles((fs) => fs.filter((f) => f.id !== fid))} />
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: files.length ? 8 : 0 }}>
            {header.filesAllowed && <FilePickerButton current={files.length} max={4} onUploaded={(f) => setFiles((fs) => [...fs, f])} label="" />}
            <textarea aria-label="Message" rows={1} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if ((text.trim() || files.length) && !send.isPending) send.mutate(); } }}
              style={{ ...input, flex: 1, resize: "none", maxHeight: 120 }} />
            <button type="button" aria-label="Send" style={btn("primary", { minWidth: 46, minHeight: 44, padding: 0 })} disabled={(!text.trim() && !files.length) || send.isPending} onClick={() => send.mutate()}><FiSend /></button>
          </div>
        </div>
      )}
      <ReportDialog open={!!reporting} onClose={() => setReporting(null)} targetType="message" targetId={reporting} reasons={me.catalogue?.reportReasons || []} what="this message" />
    </section>
  );
}

function NewChatDialog({ open, onClose, me }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [chosen, setChosen] = useState([]);
  const [title, setTitle] = useState("");
  const connections = useQuery({ queryKey: ["connect", "connections"], queryFn: connectApi.connections, enabled: open && me.canDirectMessage });
  const start = useMutation({
    mutationFn: () => connectApi.startConversation({ memberIds: chosen, title: chosen.length > 1 ? title || undefined : undefined }),
    onSuccess: (r) => { onClose(); setChosen([]); setTitle(""); qc.invalidateQueries({ queryKey: ["connect", "conversations"] }); navigate(`${base}/${r.id}`); },
    onError: (e) => toast.error(errorOf(e, "Couldn't start the chat")),
  });
  const toggle = (id) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : me.canGroupChat || !c.length ? [...c, id] : [id]));
  return (
    <Modal open={open} title="New chat" onClose={onClose}
      footer={me.canDirectMessage && <><button type="button" style={btn("ghost")} onClick={onClose}>Cancel</button><button type="button" style={btn("primary")} disabled={!chosen.length || start.isPending} onClick={() => start.mutate()}>{chosen.length > 1 ? "Start group chat" : "Start chat"}</button></>}>
      {!me.canDirectMessage ? (
        <div style={{ lineHeight: 1.6, fontFamily: FONT }}>
          <p style={{ marginTop: 0 }}>{me.rules?.directMessages === false ? "One-to-one messages are switched off on Connect." : `One-to-one messages open when you're ${me.rules?.dmMinAge}${me.profile?.directMessages === false ? " and your parent says yes" : ""}.`}</p>
          <p>You can chat with your <strong>project teams</strong> — every project has its own team chat.</p>
          <Link to={`${CONNECT_BASE}/projects`} onClick={onClose} style={{ ...btn("primary"), textDecoration: "none" }}><FiTool /> Go to projects</Link>
        </div>
      ) : connections.isLoading ? "Loading…" : (
        <>
          <p style={{ marginTop: 0, color: C.muted }}>You can message people you're connected with{me.canGroupChat ? ". Pick more than one for a group chat." : "."}</p>
          {(connections.data?.connections || []).map((c) => (
            <label key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 6px", cursor: "pointer", borderRadius: 10, background: chosen.includes(c.member.id) ? C.skyTint : "transparent" }}>
              <input type="checkbox" checked={chosen.includes(c.member.id)} onChange={() => toggle(c.member.id)} />
              <MemberAvatar card={c.member} size={32} /> <strong>{c.member.displayName}</strong>
            </label>
          ))}
          {!connections.data?.connections?.length && <p>You don't have any connections yet. <Link to={`${CONNECT_BASE}/people`} onClick={onClose}>Find people</Link> who like what you like and connect.</p>}
          {chosen.length > 1 && (<><label style={label} htmlFor="group-title">Group name (optional)</label><input id="group-title" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} style={input} /></>)}
          <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 0 }}><span style={pill("info")}>Safety</span> Never share your phone number, address or school. If anything feels wrong, report it.</p>
        </>
      )}
    </Modal>
  );
}
