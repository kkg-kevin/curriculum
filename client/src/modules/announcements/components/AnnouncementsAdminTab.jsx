import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiCopy, FiEdit2, FiEye, FiEyeOff, FiMail, FiMessageSquare, FiPlus, FiSearch, FiSend, FiSquare, FiTrash2, FiUsers, FiVolume2 } from "react-icons/fi";
import { BRAND, FONT, card, pill } from "../../../theme/brand";
import { askConfirm } from "../../../components/ui/AskDialog";
import { AnnouncementBody, REACTIONS } from "./AnnouncementView";
import AnnouncementComposer from "./AnnouncementComposer";
import { FilterChips, GROUP_LOOK, GroupTag, Meter, people, useWide } from "./ui";
import { announcementsApi, day, errorOf, when } from "../services/announcementsApi";

// Connect → Announcements (26 Nov 2026): what the team has sent or scheduled. The list filters by
// state and searches titles; each card shows who it went to and how far it got (opened, confirmed)
// as bars. One announcement: the figures, each group's reach, who hasn't opened or confirmed it
// (searchable, copyable), each group's comments on its own tab (hide one, answer in that thread),
// Edit, End now and Delete.

const STATE = {
  live: { tone: "good", label: "Live" },
  scheduled: { tone: "waiting", label: "Scheduled" },
  ended: { tone: "neutral", label: "Ended" },
};
const btn = (kind = "ghost", extra = {}) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 40, padding: "8px 14px", borderRadius: 12, border: kind === "primary" ? "none" : `1.5px solid ${kind === "danger" ? BRAND.dangerBorder : BRAND.border}`, background: kind === "primary" ? BRAND.navy : "#fff", color: kind === "primary" ? "#fff" : kind === "danger" ? BRAND.danger : BRAND.inkSoft, fontSize: 13.5, fontWeight: 800, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap", ...extra });

function Figure({ value, label, sub, icon: Icon }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 14, background: BRAND.canvas, border: `1px solid ${BRAND.line}`, minWidth: 0, display: "flex", gap: 10, alignItems: "center" }}>
      {Icon && <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: BRAND.skyTint, color: BRAND.navy, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={16} /></span>}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 21, fontWeight: 900, color: BRAND.navy, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: BRAND.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
    </div>
  );
}

function Waiting({ a }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const shown = a.waiting.filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()));
  const byGroup = useMemo(() => {
    const m = new Map();
    for (const w of shown) m.set(w.group, [...(m.get(w.group) || []), w]);
    return [...m];
  }, [shown]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(shown.map((w) => w.name).join("\n")); toast.success(`${shown.length} names copied`); } catch { toast.error("Couldn't copy"); }
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button type="button" style={btn("ghost", { justifySelf: "start" })} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {a.askAck ? <FiCheckCircle /> : <FiEye />} {open ? "Hide" : "See"} who hasn&apos;t {a.askAck ? "confirmed" : "opened it"} <span style={pill("waiting")}>{a.waitingCount}</span>
      </button>
      {open && (
        <div style={{ display: "grid", gap: 10, padding: 12, borderRadius: 14, background: BRAND.canvas, border: `1px solid ${BRAND.line}` }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, background: "#fff", flex: "1 1 220px", minWidth: 0 }}>
              <FiSearch color={BRAND.faint} />
              <input aria-label="Search names" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name…" style={{ border: "none", outline: "none", padding: "8px 0", fontSize: 14, fontFamily: FONT, width: "100%", background: "transparent" }} />
            </label>
            <button type="button" style={btn()} onClick={copy}><FiCopy /> Copy names</button>
          </div>
          {byGroup.map(([g, list]) => (
            <div key={g} style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{GROUP_LOOK[g]?.label || g} · {list.length}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 160, overflowY: "auto" }}>
                {list.map((w) => <span key={w.userId} style={{ ...pill(a.askAck && w.seen ? "info" : "neutral"), fontSize: 12.5 }}>{w.name}{a.askAck && w.seen ? " · opened" : ""}</span>)}
              </div>
            </div>
          ))}
          {!shown.length && <span style={{ fontSize: 13, color: BRAND.muted }}>Nobody matches.</span>}
          {a.waitingCount > a.waiting.length && <span style={{ fontSize: 12, color: BRAND.muted }}>Showing the first {a.waiting.length}.</span>}
        </div>
      )}
    </div>
  );
}

function CommentTabs({ a, onHide, onAnswer, answering }) {
  const threads = (a.groups || []).filter((g) => g.reached > 0 || g.comments.length);
  const [tab, setTab] = useState(threads[0]?.key);
  const [reply, setReply] = useState("");
  const g = threads.find((t) => t.key === tab) || threads[0];
  if (!g) return null;
  return (
    <section style={{ ...card, padding: "16px 18px", display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: BRAND.ink, display: "flex", gap: 8, alignItems: "center" }}><FiMessageSquare /> Comments</h3>
      <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>Each group only sees its own thread.</p>
      {threads.length > 1 && <FilterChips label="Thread" value={g.key} onChange={(k) => { setTab(k); setReply(""); }} options={threads.map((t) => [t.key, GROUP_LOOK[t.key]?.label || t.label, t.comments.filter((c) => !c.hidden).length])} />}
      {!g.comments.length && <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>No comments from {(GROUP_LOOK[g.key]?.label || g.label).toLowerCase()} yet.</p>}
      {g.comments.map((c) => (
        <div key={c.id} style={{ padding: "10px 12px", borderRadius: 12, background: c.fromTeam ? BRAND.navyTint : "#fff", border: `1px solid ${c.fromTeam ? BRAND.navyBorder : BRAND.line}`, opacity: c.hidden ? 0.55 : 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: BRAND.ink }}>{c.authorName}</strong>
            {c.fromTeam ? <span style={pill("strong", { fontSize: 10.5, padding: "1px 7px" })}>Digifunzi team</span> : c.authorRole && <span style={{ fontSize: 11.5, color: BRAND.muted }}>{c.authorRole}</span>}
            <span style={{ fontSize: 11.5, color: BRAND.faint, flex: 1 }}>{when(c.createdAt)}{c.hidden ? ` · hidden${c.hiddenBy ? ` by ${c.hiddenBy}` : ""}` : ""}</span>
            <button type="button" style={btn("ghost", { minHeight: 32, padding: "4px 10px", fontSize: 12.5 })} onClick={() => onHide(c.id, !c.hidden)}>{c.hidden ? <><FiEye /> Show</> : <><FiEyeOff /> Hide</>}</button>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: BRAND.inkSoft, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.body}</p>
        </div>
      ))}
      {a.state !== "scheduled" && (
        <form onSubmit={(e) => { e.preventDefault(); if (reply.trim()) onAnswer(g.key, reply.trim(), () => setReply("")); }} style={{ display: "flex", gap: 8 }}>
          <input aria-label={`Answer ${g.label}`} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} placeholder={`Answer ${(GROUP_LOOK[g.key]?.label || g.label).toLowerCase()} as the Digifunzi team…`} style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${BRAND.border}`, fontSize: 15, fontFamily: FONT }} />
          <button type="submit" aria-label="Send answer" style={btn("primary", { width: 44, padding: 0 })} disabled={answering || !reply.trim()}><FiSend /></button>
        </form>
      )}
    </section>
  );
}

function Detail({ id, onBack }) {
  const qc = useQueryClient();
  const wide = useWide(900);
  const key = ["announcements", "admin", id];
  const { data: a, isLoading, error } = useQuery({ queryKey: key, queryFn: () => announcementsApi.detail(id) });
  const [editing, setEditing] = useState(false);
  const done = (msg) => (d) => { if (d?.id) qc.setQueryData(key, d); qc.invalidateQueries({ queryKey: ["announcements", "admin-list"] }); if (msg) toast.success(msg); };
  const fail = (err) => toast.error(errorOf(err));
  const hide = useMutation({ mutationFn: ({ cid, hidden }) => announcementsApi.hideComment(id, cid, hidden), onSuccess: (d, v) => done(v.hidden ? "Hidden from readers" : "Shown again")(d), onError: fail });
  const answer = useMutation({ mutationFn: ({ group, body }) => announcementsApi.teamComment(id, group, body), onSuccess: (d, v) => { done("Answer posted")(d); v.after?.(); }, onError: fail });
  const end = useMutation({ mutationFn: () => announcementsApi.end(id), onSuccess: done("Ended"), onError: fail });
  const remove = useMutation({ mutationFn: () => announcementsApi.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success("Deleted"); onBack(); }, onError: fail });

  const back = <button type="button" onClick={onBack} style={{ ...btn(), borderRadius: 999, justifySelf: "start" }}><FiArrowLeft /> All announcements</button>;
  if (isLoading) return <div style={{ display: "grid", gap: 12 }}>{back}<div style={{ ...card, padding: 30, textAlign: "center", color: BRAND.faint }}>Loading…</div></div>;
  if (error) return <div style={{ display: "grid", gap: 12 }}>{back}<div style={{ ...card, padding: 24, color: BRAND.danger }}>{errorOf(error)}</div></div>;
  const st = STATE[a.state] || STATE.ended;
  const s = a.stats || {};
  const reactionText = Object.entries(a.reactionCounts || {}).filter(([, n]) => n).map(([k, n]) => `${REACTIONS[k]?.label || k} ${n}`).join(" · ");

  return (
    <div style={{ display: "grid", gap: 14, fontFamily: FONT }}>
      {back}
      <section style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 320px", minWidth: 0, display: "grid", gap: 7 }}>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={pill(st.tone)}>{st.label}</span>
                {a.important && <span style={pill("waiting")}>Important</span>}
                {a.pinned && <span style={pill("info")}>Pinned</span>}
                {a.sendEmail && <span style={pill("neutral")}><FiMail size={11} /> Emailed</span>}
              </span>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: BRAND.ink, overflowWrap: "anywhere" }}>{a.title}</h2>
              <span style={{ fontSize: 13, color: BRAND.muted }}>
                {a.authorName} · {a.state === "scheduled" ? <>goes out <strong style={{ color: BRAND.goldText }}>{when(a.publishAt)}</strong></> : `sent ${when(a.publishedAt)}`}{a.endsAt ? ` · until ${day(a.endsAt)}` : ""}
              </span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(a.audience?.groups || []).map((g) => <GroupTag key={g} group={g} />)}
                {a.audience?.hubIds?.length > 0 && <span style={pill("neutral")}>{a.audience.hubIds.length} hub{a.audience.hubIds.length === 1 ? "" : "s"}</span>}
                {a.audience?.classIds?.length > 0 && <span style={pill("neutral")}>{a.audience.classIds.length} class{a.audience.classIds.length === 1 ? "" : "es"}</span>}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: wide ? "0 0 auto" : "1 1 100%" }}>
              <button type="button" style={btn("primary")} onClick={() => setEditing(true)}><FiEdit2 /> Edit</button>
              {a.state === "live" && <button type="button" style={btn()} onClick={async () => { if (await askConfirm({ title: "End it now?", message: "It stays on people's pages marked Ended for 30 days; reactions, comments and confirming close.", confirmLabel: "End it" })) end.mutate(); }}><FiSquare /> End now</button>}
              <button type="button" style={btn("danger")} onClick={async () => { if (await askConfirm({ title: "Delete this announcement?", message: "It disappears from everyone's Announcements pages. This can't be undone.", confirmLabel: "Delete", tone: "danger" })) remove.mutate(); }}><FiTrash2 /> Delete</button>
            </div>
          </div>

          {a.state === "scheduled" ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 14, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, color: BRAND.goldText, fontSize: 14, fontWeight: 700 }}>
              <FiCalendar /> Not sent yet. It goes out {when(a.publishAt)}; you can still change who it&apos;s for.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                <Figure icon={FiUsers} value={a.recipientCount} label="Reached" />
                {a.allowReactions && <Figure icon={FiCheckCircle} value={s.reactions || 0} label="Reactions" sub={reactionText || "None yet"} />}
                {a.allowComments && <Figure icon={FiMessageSquare} value={s.comments || 0} label="Comments" />}
              </div>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: wide ? "1fr 1fr" : "100%" }}>
                <Meter label="Opened" value={s.seen} of={a.recipientCount} />
                {a.askAck && <Meter label="Confirmed reading" value={s.acked} of={a.recipientCount} tone="gold" />}
              </div>
            </>
          )}
          <details>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: BRAND.mid }}>Read the announcement</summary>
            <div style={{ marginTop: 10, padding: 14, borderRadius: 14, border: `1px solid ${BRAND.line}` }}><AnnouncementBody a={a} /></div>
          </details>
        </div>
      </section>

      {a.groups?.length > 0 && (
        <section style={{ ...card, padding: "16px 18px", display: "grid", gap: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: BRAND.ink, display: "flex", gap: 8, alignItems: "center" }}><FiUsers /> By group</h3>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: wide ? "repeat(auto-fit, minmax(260px, 1fr))" : "100%" }}>
            {a.groups.map((g) => {
              const canOpen = g.reached - g.onlyBell;
              return (
                <div key={g.key} style={{ display: "grid", gap: 8, padding: 12, borderRadius: 14, border: `1px solid ${BRAND.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <GroupTag group={g.key} />
                    <span style={{ fontSize: 12.5, color: BRAND.muted }}>{people(g.reached)}</span>
                  </div>
                  <Meter compact label="Opened" value={g.seen} of={canOpen} />
                  {a.askAck && <Meter compact label="Confirmed" value={g.acked} of={canOpen} tone="gold" />}
                  {g.onlyBell > 0 && <span style={{ fontSize: 11.5, color: BRAND.muted }}>{g.onlyBell} only got the notification (Connect not switched on)</span>}
                </div>
              );
            })}
          </div>
          {a.waitingCount > 0 && <Waiting a={a} />}
        </section>
      )}

      {a.allowComments && <CommentTabs a={a} answering={answer.isPending} onHide={(cid, hidden) => hide.mutate({ cid, hidden })} onAnswer={(group, body, after) => answer.mutate({ group, body, after })} />}

      <AnnouncementComposer open={editing} existing={a} onClose={() => setEditing(false)} onSaved={(d) => qc.setQueryData(key, d)} />
    </div>
  );
}

function Card({ a, onOpen }) {
  const st = STATE[a.state] || STATE.ended;
  const s = a.stats || {};
  return (
    <button type="button" onClick={() => onOpen(a.id)} style={{ ...card, padding: 0, overflow: "hidden", textAlign: "left", cursor: "pointer", fontFamily: FONT, display: "flex" }}>
      <span style={{ flex: 1, minWidth: 0, padding: "14px 16px", display: "grid", gap: 8 }}>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pill(st.tone)}>{st.label}</span>
          {a.important && <span style={pill("waiting")}>Important</span>}
          {a.pinned && a.state === "live" && <span style={pill("info")}>Pinned</span>}
          {(a.audience?.groups || []).map((g) => <GroupTag key={g} group={g} />)}
        </span>
        <strong style={{ fontSize: 16, color: BRAND.ink, overflowWrap: "anywhere" }}>{a.title}</strong>
        {a.summary && <span style={{ fontSize: 13, color: BRAND.inkSoft, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.summary}</span>}
        {a.state === "scheduled" ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: BRAND.goldText, fontWeight: 700 }}><FiCalendar size={13} /> Goes out {when(a.publishAt)}</span>
        ) : (
          <span style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", alignItems: "end" }}>
            <Meter compact label={`Opened · ${a.recipientCount} reached`} value={s.seen} of={a.recipientCount} />
            {a.askAck && <Meter compact label="Confirmed" value={s.acked} of={a.recipientCount} tone="gold" />}
          </span>
        )}
        <span style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: BRAND.muted }}>
          <span>{a.state === "scheduled" ? "Scheduled" : `Sent ${day(a.publishedAt)}`} by {a.authorName}</span>
          {a.allowComments && <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><FiMessageSquare size={12} /> {s.comments || 0}</span>}
          {a.allowReactions && <span>{s.reactions || 0} {s.reactions === 1 ? "reaction" : "reactions"}</span>}
        </span>
      </span>
    </button>
  );
}

export default function AnnouncementsAdminTab({ openId, onOpen, onNew }) {
  const { data = [], isLoading, error } = useQuery({ queryKey: ["announcements", "admin-list"], queryFn: announcementsApi.list });
  const [state, setState] = useState("all");
  const [q, setQ] = useState("");
  if (openId) return <Detail id={openId} onBack={() => onOpen(null)} />;
  const n = (k) => data.filter((a) => a.state === k).length;
  const shown = data.filter((a) => (state === "all" || a.state === state) && (!q.trim() || a.title.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div style={{ display: "grid", gap: 12, fontFamily: FONT }}>
      {data.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <FilterChips label="Show" value={state} onChange={setState} options={[["all", "All", data.length], ["live", "Live", n("live")], ["scheduled", "Scheduled", n("scheduled")], ["ended", "Ended", n("ended")]]} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderRadius: 12, border: `1.5px solid ${BRAND.border}`, background: "#fff", flex: "0 1 280px", minWidth: 0 }}>
            <FiSearch color={BRAND.faint} />
            <input aria-label="Search announcements" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles…" style={{ border: "none", outline: "none", padding: "9px 0", fontSize: 14, fontFamily: FONT, width: "100%", background: "transparent" }} />
          </label>
        </div>
      )}
      {isLoading && <div style={{ ...card, padding: 30, textAlign: "center", color: BRAND.faint }}>Loading…</div>}
      {error && <div style={{ ...card, padding: 24, color: BRAND.danger }}>{errorOf(error)}</div>}
      {!isLoading && !error && !data.length && (
        <div style={{ ...card, padding: "40px 22px", textAlign: "center", display: "grid", gap: 6, justifyItems: "center" }}>
          <span aria-hidden style={{ width: 56, height: 56, borderRadius: 16, background: BRAND.skyTint, color: BRAND.navy, display: "grid", placeItems: "center" }}><FiVolume2 size={24} /></span>
          <p style={{ margin: "6px 0 0", fontWeight: 900, fontSize: 16, color: BRAND.ink }}>No announcements yet</p>
          <p style={{ margin: "0 0 10px", fontSize: 13.5, color: BRAND.muted, maxWidth: 420 }}>Tell mentors, parents or learners something: a training day, a holiday, a new programme. You choose who sees it and how they can respond.</p>
          <button type="button" style={btn("primary")} onClick={onNew}><FiPlus /> New announcement</button>
        </div>
      )}
      {data.length > 0 && !shown.length && <div style={{ ...card, padding: "24px 18px", textAlign: "center", color: BRAND.muted, fontSize: 13.5 }}>Nothing matches.</div>}
      {shown.map((a) => <Card key={a.id} a={a} onOpen={onOpen} />)}
    </div>
  );
}

