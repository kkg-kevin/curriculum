import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { FiUsers, FiActivity, FiEdit3, FiMessageCircle, FiTool, FiFlag, FiAlertTriangle, FiClock, FiShield, FiPlus, FiCheck, FiX, FiSettings, FiList } from "react-icons/fi";
import { askConfirm, askText } from "../../../components/ui/AskDialog";
import { connectApi } from "../services/connectApi";
import { HERO_GRADIENT } from "../../../theme/brand";
import { C, FONT, card, btn, pill, input, label, Chip, Empty, ErrorBox, Loading, MemberAvatar, FileGallery, PlainText, Modal, IconFor, timeAgo, errorOf, ConnectStyles, ScrollRow, useNarrow } from "../components/kit";
import { PostCard, Comments } from "../components/posts";
import { usePostPages } from "./FeedPages";
import { AWARD_LABEL, ChallengeHeader, EntryCard } from "./ChallengePages";

// Digifunzi Connect for the people who look after it: admins and staff with Digifunzi Connect
// (admin app, /connect) and educators named as moderators (teacher portal, /teacher-portal/connect).
// What each sees follows the server's answer to /me (canManage, canModerateAll, canCreate).

const TABS = [
  { key: "overview", label: "Overview", icon: FiActivity, show: (m) => m.kind === "staff" || m.canModerateAll },
  { key: "posts", label: "Posts", icon: FiEdit3 },
  { key: "review", label: "Review", icon: FiShield, count: (m) => (m.counts?.openReports || 0) + (m.counts?.waitingPosts || 0) },
  { key: "members", label: "Members", icon: FiUsers, show: (m) => m.kind === "staff" || m.canModerateAll },
  { key: "communities", label: "Communities", icon: FiList },
  { key: "challenges", label: "Challenges", icon: FiFlag, show: (m) => m.canCreate || m.kind === "staff" },
  { key: "history", label: "History", icon: FiClock },
  { key: "settings", label: "Settings", icon: FiSettings, show: (m) => m.kind === "staff" },
];

export default function ConnectAdminPage() {
  const me = useQuery({ queryKey: ["connect", "me"], queryFn: connectApi.me });
  const [params, setParams] = useSearchParams();
  const narrow = useNarrow(640);
  if (me.isLoading) return <Loading rows={2} />;
  if (me.error) return <ErrorBox error={me.error} />;
  const m = me.data;
  if (m.kind === "educator" && !m.isModerator) {
    return <Empty icon="shield" title="You're not a Connect moderator">An admin can name you a moderator of Digifunzi Connect, or of one of its communities, in Connect's settings.</Empty>;
  }
  const tabs = TABS.filter((t) => !t.show || t.show(m));
  const tab = tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : tabs[0].key;
  return (
    <div className="cx" style={{ fontFamily: FONT, color: C.ink, display: "grid", gap: narrow ? 10 : 14 }}>
      <ConnectStyles />
      <header style={{ background: HERO_GRADIENT, color: "#fff", borderRadius: narrow ? 16 : 20, padding: narrow ? "12px 16px" : "18px 22px" }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold }}>Digifunzi Connect</div>
        <h1 style={{ margin: "4px 0 2px", fontSize: narrow ? 19 : 24 }}>The learners' community</h1>
        <div className="cx-hide-narrow" style={{ opacity: 0.9, fontSize: 14 }}>{m.kind === "staff" ? "Keep it safe and lively: check posts, answer reports, run communities and challenges." : "Thank you for moderating. Check posts and reports for the communities you look after."}</div>
      </header>
      <ScrollRow aria-label="Connect sections" activeKey={tab}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const n = t.count ? t.count(m) : 0;
          return (
            <button key={t.key} type="button" aria-current={tab === t.key ? "page" : undefined} onClick={() => setParams({ tab: t.key })} style={{ ...btn(tab === t.key ? "primary" : "ghost"), borderRadius: 999, minHeight: 40, flexShrink: 0 }}>
              <Icon /> {t.label}{n > 0 && <span style={{ background: C.gold, color: C.navyDeep, borderRadius: 999, padding: "0 7px", fontSize: 12 }}>{n}</span>}
            </button>
          );
        })}
      </ScrollRow>
      {tab === "overview" && <Overview />}
      {tab === "posts" && <Posts me={m} />}
      {tab === "review" && <Review me={m} />}
      {tab === "members" && <Members me={m} />}
      {tab === "communities" && <Communities me={m} />}
      {tab === "challenges" && <Challenges me={m} />}
      {tab === "history" && <History />}
      {tab === "settings" && <Settings />}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────────────────────────
function Overview() {
  const narrow = useNarrow(640);
  const q = useQuery({ queryKey: ["connect", "admin", "overview"], queryFn: connectApi.admin.overview });
  if (q.isLoading) return <Loading rows={2} />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  const tiles = [
    { icon: FiUsers, label: "Learners on Connect", value: d.members, sub: `${d.activeWeek} active this week` },
    { icon: FiEdit3, label: "Posts (30 days)", value: d.postsMonth, sub: `${d.commentsMonth} comments` },
    { icon: FiMessageCircle, label: "Messages (30 days)", value: d.messagesMonth },
    { icon: FiTool, label: "Projects", value: Object.values(d.projects).reduce((a, b) => a + b, 0), sub: `${d.projects.done || 0} finished · ${d.showcased} showcased` },
    { icon: FiFlag, label: "Challenges open", value: d.challengesOpen, sub: `${d.entries} entries in all` },
    { icon: FiAlertTriangle, label: "Waiting for you", value: d.openReports + d.waitingPosts, sub: `${d.openReports} reports · ${d.waitingPosts} posts`, warn: d.openReports + d.waitingPosts > 0 },
  ];
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ ...card, borderColor: t.warn ? C.goldBorder : C.border }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", color: C.sky, fontWeight: 900, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}><t.icon /> {t.label}</div>
            <div style={{ fontSize: narrow ? 24 : 28, fontWeight: 900, color: C.navy }}>{t.value}</div>
            {t.sub && <div style={{ fontSize: 12.5, color: C.muted }}>{t.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Posts and comments, last 12 weeks</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={d.weeks}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="week" tickFormatter={(w) => w.slice(5)} fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} width={30} />
                <Tooltip />
                <Legend />
                <Bar dataKey="posts" name="Posts" fill={C.navy} radius={[4, 4, 0, 0]} />
                <Bar dataKey="comments" name="Comments" fill={C.gold} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Biggest communities</h3>
          {d.communities.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0" }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{c.name}</span>
              <span style={{ fontSize: 12.5, color: C.muted }}>{c.memberCount} members · {c.postCount} posts</span>
            </div>
          ))}
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 0 }}>Reports decided in the last 30 days: {d.reportsDecidedMonth}{d.medianHoursToDecide != null ? ` · typically within ${d.medianHoursToDecide} h` : ""}. Suspended now: {d.suspended}.</p>
        </section>
      </div>
    </div>
  );
}

// ── Posts: every post, to take down what shouldn't be there ─────────────────────────────────────
// Posts go up without approval (the user's choice, 24 Nov 2026); moderators look through them here
// and take down (or pin) any post or comment. Workspace moderators see everything; a community's
// moderators see their own communities.
function Posts({ me }) {
  const all = me.kind === "staff" || me.canModerateAll;
  const [communityId, setCommunityId] = useState("");
  const [category, setCategory] = useState("");
  const communities = useQuery({ queryKey: ["connect", "communities", "admin"], queryFn: () => connectApi.communities({ archived: 1 }) });
  const mine = (communities.data || []).filter((c) => all || c.isModerator);
  const chosen = communityId || (all ? "" : mine[0]?.id || "");
  const query = usePostPages(["admin", chosen, category], (param) => (chosen
    ? connectApi.communityPosts(chosen, { category, ...(param || {}) })
    : connectApi.posts({ category, ...(param || {}) })), all || !!chosen);
  const pages = query.data?.pages || [];
  const items = [...(pages[0]?.pinned || []), ...pages.flatMap((p) => p.items)];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, color: C.muted, fontSize: 13.5 }}>Posts go up straight away. Use ⋯ on a post or comment to take it down — the learner is told why. Pin a post to keep it at the top.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select aria-label="Community" value={chosen} onChange={(e) => setCommunityId(e.target.value)} style={{ ...input, width: "auto", maxWidth: "100%" }}>
          {all && <option value="">Everything (main feed and every community)</option>}
          {mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...input, width: "auto", maxWidth: "100%" }}>
          <option value="">Every category</option>
          {(me.catalogue?.categories || []).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      {query.isLoading ? <Loading rows={2} /> : query.error ? <ErrorBox error={query.error} onRetry={query.refetch} /> : items.length ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 460px), 1fr))", gap: 12, alignItems: "start" }}>
            {items.map((p) => <ModeratedPost key={p.id} post={p} me={me} />)}
          </div>
          {query.hasNextPage && <button type="button" style={btn("ghost", { justifySelf: "center" })} disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Show more"}</button>}
        </>
      ) : <Empty icon="edit-3" title="No posts yet" />}
    </div>
  );
}

// A post with its comments one click away — each comment can be taken down too.
function ModeratedPost({ post, me }) {
  const [open, setOpen] = useState(false);
  const full = useQuery({ queryKey: ["connect", "post", post.id], queryFn: () => connectApi.post(post.id), enabled: open });
  return (
    <div>
      <PostCard post={post} me={me} />
      {post.commentCount > 0 && <button type="button" style={btn("link")} onClick={() => setOpen((o) => !o)}>{open ? "Hide comments" : `Show ${post.commentCount} comment${post.commentCount === 1 ? "" : "s"}`}</button>}
      {open && (full.data ? <Comments post={full.data} me={me} /> : full.error ? <ErrorBox error={full.error} /> : <Loading rows={1} />)}
    </div>
  );
}

// ── Review: waiting posts and reports ────────────────────────────────────────────────────────────
function Review({ me }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const waiting = useQuery({ queryKey: ["connect", "admin", "waiting"], queryFn: connectApi.admin.waiting });
  const reports = useQuery({ queryKey: ["connect", "admin", "reports", status], queryFn: () => connectApi.admin.reports(status) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["connect", "admin"] }); qc.invalidateQueries({ queryKey: ["connect", "me"] }); };
  const approve = async (p) => { try { await connectApi.admin.approve(p.id); toast.success("It's up"); refresh(); } catch (e) { toast.error(errorOf(e)); } };
  const reject = async (p) => {
    const reason = await askText({ title: "Don't post this?", message: "The learner is told it wasn't posted. Say why kindly — they'll read it.", label: "Reason", required: false, tone: "danger", confirmLabel: "Don't post" });
    if (reason === null) return;
    try { await connectApi.admin.reject(p.id, reason); refresh(); } catch (e) { toast.error(errorOf(e)); }
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section>
        <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Posts waiting for a check ({waiting.data?.length || 0})</h2>
        {waiting.isLoading ? <Loading rows={1} /> : waiting.error ? <ErrorBox error={waiting.error} /> : waiting.data.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {waiting.data.map((p) => (
              <div key={p.id}>
                {p.learner && <div style={{ fontSize: 12.5, color: C.muted, margin: "0 0 4px 6px" }}>From <strong>{p.learner.name}</strong>{p.learner.age != null ? `, ${p.learner.age}` : ""} · posting as “{p.author.displayName}”</div>}
                <PostCard post={p} me={me} />
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button type="button" style={btn("primary")} onClick={() => approve(p)}><FiCheck /> Post it</button>
                  <button type="button" style={btn("danger")} onClick={() => reject(p)}><FiX /> Don't post</button>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty icon="shield" title="Nothing waiting">Posts go up straight away. They only wait here if you switch checking on in Settings.</Empty>}
      </section>
      <section>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, margin: 0, flex: 1 }}>Reports</h2>
          {["open", "actioned", "dismissed", "all"].map((s) => <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s === "open" ? "To decide" : s === "actioned" ? "Acted on" : s[0].toUpperCase() + s.slice(1)}</Chip>)}
        </div>
        {reports.isLoading ? <Loading rows={1} /> : reports.error ? <ErrorBox error={reports.error} /> : reports.data.items.length ? (
          <div style={{ display: "grid", gap: 10 }}>{reports.data.items.map((r) => <ReportCard key={r.id} r={r} me={me} onDone={refresh} />)}</div>
        ) : <Empty icon="shield" title={status === "open" ? "No reports to decide" : "None"} />}
      </section>
    </div>
  );
}

function ReportCard({ r, me, onDone }) {
  const [context, setContext] = useState(null);
  const [deciding, setDeciding] = useState(null);
  const [days, setDays] = useState(3);
  const [note, setNote] = useState("");
  const loadContext = async () => {
    try { setContext(await connectApi.admin.reportContext(r.id)); } catch (e) { toast.error(errorOf(e)); }
  };
  const decide = async () => {
    try { await connectApi.admin.decide(r.id, { action: deciding, days: deciding === "suspend" ? Number(days) : undefined, note: note || undefined }); toast.success("Done"); setDeciding(null); onDone(); } catch (e) { toast.error(errorOf(e)); }
  };
  const snap = r.snapshot || {};
  return (
    <article style={{ ...card, borderLeft: `5px solid ${r.status === "open" ? C.gold : C.border}` }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={pill("waiting")}>{r.reasonLabel}</span>
        <span style={pill("neutral")}>{r.what}</span>
        {r.currentStatus && r.currentStatus !== "visible" && <span style={pill("danger")}>Now: {r.currentStatus}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: C.muted }}>{timeAgo(r.createdAt)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 10, fontSize: 13.5 }}>
        <div><div style={{ color: C.muted, fontWeight: 800, fontSize: 12 }}>ABOUT</div>{r.about ? <><strong>{r.about.learner?.name || r.about.displayName}</strong>{r.about.learner?.age != null ? `, ${r.about.learner.age}` : ""} · “{r.about.displayName}”{r.about.earlierActions ? <div style={{ color: C.danger }}>{r.about.earlierActions} earlier report(s) acted on</div> : null}</> : "—"}</div>
        <div><div style={{ color: C.muted, fontWeight: 800, fontSize: 12 }}>REPORTED BY</div>{r.reporter?.learner?.name || r.reporter?.displayName}{r.note ? <div style={{ fontStyle: "italic" }}>“{r.note}”</div> : null}</div>
      </div>
      <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: C.canvas, border: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 800, marginBottom: 4 }}>WHAT WAS REPORTED (as it was then)</div>
        {snap.title && <strong>{snap.title}</strong>}
        {snap.displayName && <div><strong>Name:</strong> {snap.displayName}</div>}
        <PlainText>{snap.body || snap.description || snap.bio || ""}</PlainText>
        <FileGallery files={snap.files || []} compact />
      </div>
      {(r.targetType === "message" || r.targetType === "comment") && r.status === "open" && (me.kind === "staff" || me.canModerateAll) && (
        context ? (
          <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: `1px dashed ${C.border}` }}>
            {context.messages ? context.messages.map((m) => (
              <div key={m.id} style={{ display: "flex", gap: 8, padding: "4px 0", background: m.reported ? C.goldTint : "transparent", borderRadius: 8 }}>
                <MemberAvatar card={m.sender} size={22} /><strong style={{ fontSize: 13 }}>{m.sender?.displayName}:</strong>
                <span style={{ fontSize: 13.5, flex: 1 }}>{m.body}{m.status !== "visible" ? " (removed)" : ""}</span>
                <span style={{ fontSize: 11, color: C.faint }}>{new Date(m.createdAt).toLocaleString()}</span>
              </div>
            )) : context.post ? <PostCard post={context.post} me={me} /> : null}
            {context.messages && <p style={{ fontSize: 12, color: C.muted, marginBottom: 0 }}>Reading this conversation is recorded in Connect's history.</p>}
          </div>
        ) : <button type="button" style={{ ...btn("link"), marginTop: 6 }} onClick={loadContext}>{r.targetType === "message" ? "Read the conversation around it" : "See the post"}</button>
      )}
      {r.status === "open" ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" style={btn("ghost")} onClick={() => setDeciding("dismiss")}>It's fine</button>
          <button type="button" style={btn("danger")} onClick={() => setDeciding("remove")}>Take it down</button>
          {(me.kind === "staff" || me.canModerateAll) && r.about && <button type="button" style={btn("danger")} onClick={() => setDeciding("suspend")}>Take down + pause posting</button>}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 13, color: C.muted }}>{r.action === "dismiss" ? "Left up" : r.action === "suspend" ? "Taken down, posting paused" : "Taken down"} by {r.decidedByName} {timeAgo(r.decidedAt)}{r.decisionNote ? ` — ${r.decisionNote}` : ""}</div>
      )}
      <Modal open={!!deciding} title={deciding === "dismiss" ? "Leave it up" : deciding === "suspend" ? "Take down and pause posting" : "Take it down"} onClose={() => setDeciding(null)}
        footer={<><button type="button" style={btn("ghost")} onClick={() => setDeciding(null)}>Cancel</button><button type="button" style={btn(deciding === "dismiss" ? "primary" : "danger")} onClick={decide}>Confirm</button></>}>
        {deciding === "suspend" && (<><label style={label} htmlFor="sus-days">Pause posting and messages for (days)</label><input id="sus-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} style={input} /></>)}
        <label style={label} htmlFor="dec-note">{deciding === "dismiss" ? "Note (for the history)" : "Reason (the learner reads this)"}</label>
        <textarea id="dec-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} style={input} />
        <p style={{ fontSize: 13, color: C.muted }}>The learner who reported it is thanked. If a child may be at risk, follow your safeguarding steps and contact their parent too.</p>
      </Modal>
    </article>
  );
}

// ── Members ──────────────────────────────────────────────────────────────────────────────────────
function Members({ me }) {
  const qc = useQueryClient();
  const narrow = useNarrow(760);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [recording, setRecording] = useState(false);
  const list = useQuery({ queryKey: ["connect", "admin", "members", q, status], queryFn: () => connectApi.admin.members({ q, status }) });
  const suspend = async (m) => {
    const reason = await askText({ title: `Pause ${m.displayName}'s posting?`, message: "They can still read Connect. This is for 7 days; they'll see the reason.", label: "Reason", required: true, tone: "danger", confirmLabel: "Pause for 7 days" });
    if (!reason) return;
    try { await connectApi.admin.suspend(m.id, { days: 7, reason }); qc.invalidateQueries({ queryKey: ["connect", "admin"] }); } catch (e) { toast.error(errorOf(e)); }
  };
  const restore = async (m) => { try { await connectApi.admin.restore(m.id); qc.invalidateQueries({ queryKey: ["connect", "admin"] }); } catch (e) { toast.error(errorOf(e)); } };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input aria-label="Search members" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...input, flex: 1, minWidth: 200 }} />
        {[["", "Everyone"], ["active", "On"], ["suspended", "Paused"], ["off", "Switched off"]].map(([k, v]) => <Chip key={k} active={status === k} onClick={() => setStatus(k)}>{v}</Chip>)}
        {me.kind === "staff" && me.canManage && <button type="button" style={btn("gold")} onClick={() => setRecording(true)}><FiPlus /> Switch on with recorded consent</button>}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Parents switch Connect on from their own account. Contact details are never shown here.</p>
      {list.isLoading ? <Loading rows={2} /> : list.error ? <ErrorBox error={list.error} /> : list.data.length && narrow ? (
        <div style={{ display: "grid", gap: 8 }}>
          {list.data.map((m) => <MemberCardRow key={m.id} m={m} me={me} onSuspend={suspend} onRestore={restore} />)}
        </div>
      ) : list.data.length ? (
        <div style={{ ...card, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead><tr style={{ textAlign: "left", color: C.muted, fontSize: 12 }}>{["Learner", "On Connect as", "Status", "Consent", "Posts", "Reports", "Last seen", ""].map((h) => <th key={h} style={{ padding: "10px 12px", borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {list.data.map((m) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td style={{ padding: "8px 12px" }}><strong>{m.learner?.name}</strong>{m.learner?.age != null ? <span style={{ color: C.muted }}> · {m.learner.age}</span> : null}</td>
                  <td style={{ padding: "8px 12px" }}><span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><MemberAvatar card={m.card} size={24} /> {m.displayName}</span></td>
                  <td style={{ padding: "8px 12px" }}><span style={pill(m.status === "active" ? "good" : m.status === "suspended" ? "waiting" : "neutral")}>{m.status === "active" ? "On" : m.status === "suspended" ? `Paused to ${new Date(m.suspendedUntil).toLocaleDateString("en-GB")}` : "Off"}</span>{!m.directMessages && <span style={{ ...pill("neutral"), marginLeft: 4 }}>No DMs</span>}</td>
                  <td style={{ padding: "8px 12px" }} title={m.consentNote || ""}>{m.consentMethod === "recorded" ? "Recorded by staff" : "Parent"}{m.consentAt ? ` · ${new Date(m.consentAt).toLocaleDateString("en-GB")}` : ""}</td>
                  <td style={{ padding: "8px 12px" }}>{m.postsSent}</td>
                  <td style={{ padding: "8px 12px", color: m.reports ? C.danger : C.ink }}>{m.reports}</td>
                  <td style={{ padding: "8px 12px", color: C.muted }}>{m.lastSeenAt ? timeAgo(m.lastSeenAt) : "—"}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                    {(me.kind === "staff" || me.canModerateAll) && m.status === "active" && <button type="button" style={btn("link")} onClick={() => suspend(m)}>Pause</button>}
                    {(me.kind === "staff" || me.canModerateAll) && m.status === "suspended" && <button type="button" style={btn("link")} onClick={() => restore(m)}>Restore</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty icon="users" title="No learners here yet">Learners appear once a parent switches Connect on for them.</Empty>}
      <RecordConsentDialog open={recording} onClose={() => setRecording(false)} />
    </div>
  );
}

// One member as a card (phones): the same facts as the table.
function MemberCardRow({ m, me, onSuspend, onRestore }) {
  const mod = me.kind === "staff" || me.canModerateAll;
  return (
    <div style={{ ...card, padding: 14, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <MemberAvatar card={m.card} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{m.learner?.name}</strong>{m.learner?.age != null ? <span style={{ color: C.muted }}> · {m.learner.age}</span> : null}
          <div style={{ fontSize: 13, color: C.muted }}>On Connect as {m.displayName}</div>
        </div>
        <span style={pill(m.status === "active" ? "good" : m.status === "suspended" ? "waiting" : "neutral")}>{m.status === "active" ? "On" : m.status === "suspended" ? "Paused" : "Off"}</span>
      </div>
      <div style={{ fontSize: 13, color: C.muted, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span>{m.consentMethod === "recorded" ? "Consent recorded by staff" : "Parent consent"}{m.consentAt ? ` · ${new Date(m.consentAt).toLocaleDateString("en-GB")}` : ""}</span>
        <span>{m.postsSent} posts</span>
        <span style={{ color: m.reports ? C.danger : C.muted }}>{m.reports} reports</span>
        <span>Seen {m.lastSeenAt ? timeAgo(m.lastSeenAt) : "never"}</span>
        {!m.directMessages && <span>No DMs</span>}
      </div>
      {m.status === "suspended" && <div style={{ fontSize: 13, color: C.goldText }}>Paused until {new Date(m.suspendedUntil).toLocaleDateString("en-GB")}{m.suspendedReason ? ` — ${m.suspendedReason}` : ""}</div>}
      {mod && m.status === "active" && <button type="button" style={btn("ghost", { justifySelf: "start" })} onClick={() => onSuspend(m)}>Pause posting</button>}
      {mod && m.status === "suspended" && <button type="button" style={btn("ghost", { justifySelf: "start" })} onClick={() => onRestore(m)}>Restore</button>}
    </div>
  );
}

function RecordConsentDialog({ open, onClose }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState(null);
  const [note, setNote] = useState("");
  const list = useQuery({ queryKey: ["connect", "admin", "consent", q], queryFn: () => connectApi.admin.consentCandidates(q), enabled: open && q.trim().length >= 2 });
  const save = useMutation({
    mutationFn: () => connectApi.admin.recordConsent({ learnerId: chosen.learnerId, note }),
    onSuccess: () => { toast.success(`${chosen.name} is on Connect`); setChosen(null); setNote(""); setQ(""); onClose(); qc.invalidateQueries({ queryKey: ["connect", "admin"] }); },
    onError: (e) => toast.error(errorOf(e)),
  });
  return (
    <Modal open={open} title="Switch on with consent recorded" onClose={onClose}
      footer={<><button type="button" style={btn("ghost")} onClick={onClose}>Cancel</button><button type="button" style={btn("primary")} disabled={!chosen || note.trim().length < 10 || save.isPending} onClick={() => save.mutate()}>Switch on</button></>}>
      <p style={{ marginTop: 0, color: C.muted }}>Only when a parent gave consent another way (a signed form, in person, by phone). Their parent can still switch it off from their account.</p>
      <label style={label} htmlFor="rc-q">Learner</label>
      <input id="rc-q" value={q} onChange={(e) => { setQ(e.target.value); setChosen(null); }} placeholder="Type a name" style={input} />
      {(list.data || []).map((l) => (
        <button key={l.learnerId} type="button" disabled={l.status === "active"} onClick={() => setChosen(l)} style={{ ...btn(chosen?.learnerId === l.learnerId ? "soft" : "link"), width: "100%", justifyContent: "flex-start", marginTop: 4 }}>
          {l.name}{l.age != null ? ` · ${l.age}` : ""} {l.status === "active" ? "(already on)" : l.status === "off" ? "(switched off before)" : ""}
        </button>
      ))}
      {q.trim().length >= 2 && list.data && !list.data.length && <p style={{ color: C.muted }}>No learner with their own login matches.</p>}
      <label style={label} htmlFor="rc-note">How the parent gave consent</label>
      <textarea id="rc-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} style={input} placeholder="e.g. Signed form from Mrs Achieng, 24 Nov 2026, filed at the hub" />
    </Modal>
  );
}

// ── Communities ──────────────────────────────────────────────────────────────────────────────────
function Communities({ me }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [members, setMembers] = useState(null);
  const list = useQuery({ queryKey: ["connect", "communities", "admin"], queryFn: () => connectApi.communities({ archived: 1 }) });
  const settings = useQuery({ queryKey: ["connect", "admin", "settings"], queryFn: connectApi.admin.settings, enabled: me.kind === "staff" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["connect", "communities"] });
  const archive = async (c) => {
    const to = c.status !== "archived";
    if (to && !(await askConfirm({ title: `Archive ${c.name}?`, message: "Learners can't see it or post in it. Its posts are kept; you can bring it back.", confirmLabel: "Archive" }))) return;
    try { await connectApi.archiveCommunity(c.id, to); refresh(); } catch (e) { toast.error(errorOf(e)); }
  };
  const shown = (list.data || []).filter((c) => me.kind === "staff" || me.canModerateAll || c.isModerator);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {me.canCreate && <button type="button" style={btn("gold", { justifySelf: "start" })} onClick={() => setEditing({})}><FiPlus /> New community</button>}
      {list.isLoading ? <Loading rows={2} /> : list.error ? <ErrorBox error={list.error} /> : (
        <div style={{ display: "grid", gap: 8 }}>
          {shown.map((c) => (
            <div key={c.id} style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", opacity: c.status === "archived" ? 0.6 : 1 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: c.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><IconFor name={c.icon} /></span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>{c.name}</strong> {c.status === "archived" && <span style={pill("neutral")}>Archived</span>} {c.joinMode === "approval" && <span style={pill("info")}>Approval to join</span>} {c.postingMode === "moderators" && <span style={pill("info")}>Moderators post</span>}
                <div style={{ fontSize: 12.5, color: C.muted }}>{c.memberCount} members · {c.postCount} posts</div>
              </div>
              <button type="button" style={btn("ghost")} onClick={() => setMembers(c)}>Members</button>
              {(me.kind === "staff" && me.canManage) || c.isModerator ? <button type="button" style={btn("ghost")} onClick={() => setEditing(c)}>Edit</button> : null}
              {me.kind === "staff" && me.canManage && <button type="button" style={btn("ghost")} onClick={() => archive(c)}>{c.status === "archived" ? "Restore" : "Archive"}</button>}
            </div>
          ))}
        </div>
      )}
      {editing && <CommunityForm c={editing} me={me} options={settings.data?.moderatorOptions || []} onClose={() => { setEditing(null); refresh(); }} />}
      {members && <CommunityMembers c={members} onClose={() => setMembers(null)} />}
    </div>
  );
}

function CommunityForm({ c, me, options, onClose }) {
  const isNew = !c.id;
  const [f, setF] = useState({ name: c.name || "", description: c.description || "", icon: c.icon || "users", color: c.color || "#25476a", topics: c.topics || [], joinMode: c.joinMode || "open", postingMode: c.postingMode || "members" });
  const [mods, setMods] = useState(null);
  const catalogue = me.catalogue;
  useEffect(() => {
    if (!isNew && me.kind === "staff") connectApi.community(c.slug).then((d) => setMods(d.moderators.map((m) => m.userId).filter(Boolean))).catch(() => setMods([]));
  }, [c.slug, isNew, me.kind]);
  const save = async () => {
    try {
      const saved = isNew ? await connectApi.createCommunity(f) : await connectApi.updateCommunity(c.id, f);
      if (me.kind === "staff" && me.canManage && mods) await connectApi.setModerators(saved.id, mods);
      toast.success("Saved");
      onClose();
    } catch (e) { toast.error(errorOf(e)); }
  };
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open title={isNew ? "New community" : `Edit ${c.name}`} onClose={onClose} width={620}
      footer={<><button type="button" style={btn("ghost")} onClick={onClose}>Cancel</button><button type="button" style={btn("primary")} disabled={f.name.trim().length < 3} onClick={save}>Save</button></>}>
      <label style={label} htmlFor="cf-name">Name</label>
      <input id="cf-name" maxLength={80} value={f.name} onChange={set("name")} style={input} />
      <label style={label} htmlFor="cf-desc">What it's for</label>
      <textarea id="cf-desc" rows={3} maxLength={1000} value={f.description} onChange={set("description")} style={input} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={label} htmlFor="cf-icon">Icon</label><select id="cf-icon" value={f.icon} onChange={set("icon")} style={input}>{["users", "code", "cpu", "zap", "play", "globe", "sun", "box", "star", "music", "feather", "compass"].map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
        <div><label style={label} htmlFor="cf-color">Colour</label><select id="cf-color" value={f.color} onChange={set("color")} style={input}>{catalogue.avatarColors.map((col) => <option key={col} value={col}>{col}</option>)}</select></div>
        <div><label style={label} htmlFor="cf-join">Joining</label><select id="cf-join" value={f.joinMode} onChange={set("joinMode")} style={input}><option value="open">Anyone can join</option><option value="approval">A moderator says yes</option></select></div>
        <div><label style={label} htmlFor="cf-post">Who posts</label><select id="cf-post" value={f.postingMode} onChange={set("postingMode")} style={input}><option value="members">Every member</option><option value="moderators">Only moderators (announcements)</option></select></div>
      </div>
      <span style={label}>Suggested to learners into</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{catalogue.interests.map((i) => <Chip key={i.key} active={f.topics.includes(i.key)} onClick={() => setF((x) => ({ ...x, topics: x.topics.includes(i.key) ? x.topics.filter((t) => t !== i.key) : [...x.topics, i.key].slice(0, 6) }))}>{i.label}</Chip>)}</div>
      {me.kind === "staff" && me.canManage && (
        <>
          <span style={label}>Moderators (educators and staff — never learners)</span>
          {!isNew && mods === null ? "Loading…" : (
            <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 12, padding: 6 }}>
              {options.map((o) => (
                <label key={o.userId} style={{ display: "flex", gap: 8, padding: "4px 6px", cursor: "pointer" }}>
                  <input type="checkbox" checked={(mods || []).includes(o.userId)} onChange={() => setMods((m) => ((m || []).includes(o.userId) ? m.filter((x) => x !== o.userId) : [...(m || []), o.userId]))} />
                  {o.name} <span style={pill("neutral")}>{o.role}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function CommunityMembers({ c, onClose }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["connect", "admin", "community-members", c.id], queryFn: () => connectApi.communityMembers(c.id) });
  const act = async (memberId, action) => { try { qc.setQueryData(["connect", "admin", "community-members", c.id], await connectApi.setMembership(c.id, memberId, action)); qc.invalidateQueries({ queryKey: ["connect", "communities"] }); } catch (e) { toast.error(errorOf(e)); } };
  return (
    <Modal open title={`${c.name}: members`} onClose={onClose}>
      {list.isLoading ? "Loading…" : list.error ? <ErrorBox error={list.error} /> : !list.data.length ? <p style={{ color: C.muted }}>No members yet.</p> : list.data.map((r) => (
        <div key={r.member.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.line}` }}>
          <MemberAvatar card={r.member} size={28} /><strong style={{ flex: 1 }}>{r.member.displayName}</strong>
          {r.status === "pending" ? <>
            <button type="button" style={btn("primary", { padding: "5px 10px" })} onClick={() => act(r.member.id, "approve")}>Let in</button>
            <button type="button" style={btn("ghost", { padding: "5px 10px" })} onClick={() => act(r.member.id, "decline")}>Decline</button>
          </> : <>
            <span style={pill(r.status === "active" ? "good" : "waiting")}>{r.status === "active" ? "Member" : "Invited"}</span>
            <button type="button" style={btn("link")} onClick={() => act(r.member.id, "remove")}>Remove</button>
          </>}
        </div>
      ))}
    </Modal>
  );
}

// ── Challenges ───────────────────────────────────────────────────────────────────────────────────
function Challenges({ me }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const list = useQuery({ queryKey: ["connect", "challenges", "manage"], queryFn: () => connectApi.challenges("manage") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["connect", "challenges"] });
  if (open) return <ChallengeManage id={open} me={me} onBack={() => { setOpen(null); refresh(); }} onEdit={(c) => setEditing(c)} />;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {me.canCreate && <button type="button" style={btn("gold", { justifySelf: "start" })} onClick={() => setEditing({})}><FiPlus /> New challenge</button>}
      {list.isLoading ? <Loading rows={2} /> : list.error ? <ErrorBox error={list.error} /> : list.data.length ? list.data.map((c) => (
        <button key={c.id} type="button" onClick={() => setOpen(c.id)} style={{ ...card, textAlign: "left", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", fontFamily: FONT }}>
          <FiFlag color={C.gold} />
          <strong style={{ flex: 1 }}>{c.title}</strong>
          <span style={pill(c.status === "open" ? "good" : c.status === "draft" ? "waiting" : "neutral")}>{c.status === "open" ? "Open" : c.status === "draft" ? "Draft" : "Closed"}</span>
          <span style={{ fontSize: 13, color: C.muted }}>{c.entries} entries</span>
        </button>
      )) : <Empty icon="flag" title="No challenges yet">Create a coding, robotics or AI challenge — individuals or teams can take part.</Empty>}
      {editing && <ChallengeForm c={editing} me={me} onClose={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

function ChallengeManage({ id, me, onBack, onEdit }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["connect", "challenge", id], queryFn: () => connectApi.challenge(id) });
  const set = (d) => qc.setQueryData(["connect", "challenge", id], d);
  const act = async (fn, ok) => { try { set(await fn()); if (ok) toast.success(ok); } catch (e) { toast.error(errorOf(e)); } };
  if (q.isLoading) return <Loading rows={2} />;
  if (q.error) return <ErrorBox error={q.error} />;
  const c = q.data;
  const remove = async () => {
    if (!(await askConfirm({ title: "Delete this challenge?", confirmLabel: "Delete", tone: "danger" }))) return;
    try { await connectApi.deleteChallenge(c.id); onBack(); } catch (e) { toast.error(errorOf(e)); }
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <button type="button" style={btn("link", { justifySelf: "start" })} onClick={onBack}>← All challenges</button>
      <ChallengeHeader c={c} me={me} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={btn("ghost")} onClick={() => onEdit(c)}>Edit</button>
        {c.status !== "open" && <button type="button" style={btn("gold")} onClick={() => act(() => connectApi.publishChallenge(c.id), c.status === "draft" ? "Open — every learner on Connect was told" : "Open again")}>{c.status === "draft" ? "Open and announce" : "Open again"}</button>}
        {c.status === "open" && <button type="button" style={btn("ghost")} onClick={() => act(() => connectApi.closeChallenge(c.id), "Closed")}>Close entries</button>}
        {!c.entries.length && <button type="button" style={btn("danger")} onClick={remove}>Delete</button>}
      </div>
      <h3 style={{ margin: "8px 0 0" }}>Entries ({c.entries.length})</h3>
      {c.entries.map((e) => (
        <EntryCard key={e.id} e={e}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Award:</span>
            {[null, ...me.catalogue.awards].map((a) => (
              <Chip key={a || "none"} active={(e.award || null) === a} onClick={async () => {
                const feedback = a ? await askText({ title: `${AWARD_LABEL[a]}: feedback`, message: "The team reads this on the challenge page.", label: "Feedback (optional)", required: false, placeholder: e.feedback || "" }) : "";
                if (feedback === null) return;
                act(() => connectApi.award(c.id, e.id, { award: a, feedback: feedback || undefined }), a ? "Award given — the team was told" : "Award cleared");
              }}>{a ? AWARD_LABEL[a] : "None"}</Chip>
            ))}
          </div>
        </EntryCard>
      ))}
      {!c.entries.length && <Empty icon="flag" title="No entries yet" />}
    </div>
  );
}

function ChallengeForm({ c, me, onClose }) {
  const isNew = !c.id;
  const [f, setF] = useState({ title: c.title || "", description: c.description || "", kind: c.kind || "coding", entryMode: c.entryMode || "individual", teamMin: c.teamMin || "", teamMax: c.teamMax || "", startsOn: c.startsOn || "", endsOn: c.endsOn || "", prizes: c.prizes || "", rules: c.rules || "", communityId: c.communityId || "", competitionId: c.competitionId || "" });
  const competitions = useQuery({ queryKey: ["connect", "competition-options"], queryFn: connectApi.competitionOptions });
  const communities = useQuery({ queryKey: ["connect", "communities", "all", ""], queryFn: () => connectApi.communities() });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    const body = { ...f, teamMin: f.teamMin ? Number(f.teamMin) : null, teamMax: f.teamMax ? Number(f.teamMax) : null, startsOn: f.startsOn || null, endsOn: f.endsOn || null, communityId: f.communityId || null, competitionId: f.competitionId || null };
    try { if (isNew) await connectApi.createChallenge(body); else await connectApi.updateChallenge(c.id, body); toast.success(isNew ? "Saved as a draft — open it when ready" : "Saved"); onClose(); } catch (e) { toast.error(errorOf(e)); }
  };
  return (
    <Modal open title={isNew ? "New challenge" : "Edit challenge"} onClose={onClose} width={680}
      footer={<><button type="button" style={btn("ghost")} onClick={onClose}>Cancel</button><button type="button" style={btn("primary")} disabled={f.title.trim().length < 3} onClick={save}>Save</button></>}>
      <label style={label} htmlFor="ch-title">Title</label>
      <input id="ch-title" maxLength={150} value={f.title} onChange={set("title")} style={input} />
      <label style={label} htmlFor="ch-desc">The challenge</label>
      <textarea id="ch-desc" rows={4} maxLength={5000} value={f.description} onChange={set("description")} style={input} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <div><label style={label} htmlFor="ch-kind">Kind</label><select id="ch-kind" value={f.kind} onChange={set("kind")} style={input}>{me.catalogue.challengeKinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></div>
        <div><label style={label} htmlFor="ch-mode">Who enters</label><select id="ch-mode" value={f.entryMode} onChange={set("entryMode")} style={input}><option value="individual">Individuals</option><option value="team">Teams</option><option value="both">Both</option></select></div>
        <div><label style={label} htmlFor="ch-min">Smallest team</label><input id="ch-min" type="number" min={2} max={8} value={f.teamMin} onChange={set("teamMin")} disabled={f.entryMode === "individual"} style={input} /></div>
        <div><label style={label} htmlFor="ch-max">Biggest team</label><input id="ch-max" type="number" min={2} max={8} value={f.teamMax} onChange={set("teamMax")} disabled={f.entryMode === "individual"} style={input} /></div>
        <div><label style={label} htmlFor="ch-start">Starts</label><input id="ch-start" type="date" value={f.startsOn} onChange={set("startsOn")} style={input} /></div>
        <div><label style={label} htmlFor="ch-end">Ends</label><input id="ch-end" type="date" value={f.endsOn} onChange={set("endsOn")} style={input} /></div>
      </div>
      <label style={label} htmlFor="ch-rules">Rules</label>
      <textarea id="ch-rules" rows={3} maxLength={4000} value={f.rules} onChange={set("rules")} style={input} />
      <label style={label} htmlFor="ch-prizes">Prizes (optional)</label>
      <textarea id="ch-prizes" rows={2} maxLength={1000} value={f.prizes} onChange={set("prizes")} style={input} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={label} htmlFor="ch-comm">Announce to</label><select id="ch-comm" value={f.communityId} onChange={set("communityId")} style={input}><option value="">Everyone on Connect</option>{(communities.data || []).map((x) => <option key={x.id} value={x.id}>{x.name} members</option>)}</select></div>
        <div><label style={label} htmlFor="ch-comp">Part of a competition</label><select id="ch-comp" value={f.competitionId} onChange={set("competitionId")} style={input}><option value="">No</option>{(competitions.data || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      </div>
    </Modal>
  );
}

// ── History ──────────────────────────────────────────────────────────────────────────────────────
const ACTIONS = {
  post_removed: "took a post down", post_rejected: "didn't post a waiting post", post_approved: "let a post go up", post_pinned: "pinned a post", post_unpinned: "unpinned a post",
  comment_removed: "took a comment down", update_removed: "took a project update down", report_dismissed: "left a reported item up", report_removed: "took a reported item down",
  report_removed_and_suspended: "took a reported item down and paused the author", report_messages_read: "read a reported conversation", member_suspended: "paused a learner's posting",
  member_restored: "restored a learner", consent_recorded: "switched Connect on with recorded consent", parent_withdrew: "(parent) switched Connect off",
  parent_withdrew_and_deleted: "(parent) switched Connect off and deleted their child's posts", community_created: "created a community", community_updated: "edited a community",
  community_archived: "archived a community", community_restored: "restored a community", community_moderators_set: "set a community's moderators",
  community_request_declined: "declined a request to join", community_member_removed: "removed a community member", challenge_created: "created a challenge",
  challenge_opened: "opened a challenge", challenge_closed: "closed a challenge", challenge_deleted: "deleted a challenge", challenge_award: "gave a challenge award",
  project_remove: "took a project down", project_restore: "restored a project", project_unshowcase: "took a project out of the showcase", settings_changed: "changed Connect's settings",
};

function History() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["connect", "admin", "history", page], queryFn: () => connectApi.admin.history(page), placeholderData: (p) => p });
  if (q.isLoading) return <Loading rows={2} />;
  if (q.error) return <ErrorBox error={q.error} />;
  return (
    <div style={{ ...card, padding: 0 }}>
      {q.data.items.map((r) => (
        <div key={r.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.line}`, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: C.muted, minWidth: 110 }}>{new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          <span style={{ flex: 1, minWidth: 200 }}><strong>{r.actorName || "Someone"}</strong>{r.actorRole ? ` (${r.actorRole})` : ""} {ACTIONS[r.action] || r.action.replace(/_/g, " ")}{r.member ? <> — <em>{r.member.displayName}</em></> : null}{r.note ? <span style={{ color: C.muted }}> · {r.note}</span> : null}</span>
        </div>
      ))}
      {!q.data.items.length && <p style={{ padding: 16, color: C.muted }}>Nothing yet.</p>}
      <div style={{ display: "flex", gap: 8, padding: 10, justifyContent: "center" }}>
        {page > 1 && <button type="button" style={btn("ghost")} onClick={() => setPage((p) => p - 1)}>Newer</button>}
        {q.data.hasMore && <button type="button" style={btn("ghost")} onClick={() => setPage((p) => p + 1)}>Older</button>}
      </div>
    </div>
  );
}

// Outside Settings, so typing in a box never remounts it.
const Box = ({ title, children }) => <section style={card}><h3 style={{ marginTop: 0, fontSize: 16 }}>{title}</h3>{children}</section>;
const SettingCheck = ({ checked, onChange, disabled, children }) => <label style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "8px 0", fontWeight: 600 }}><input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ marginTop: 3 }} /> <span>{children}</span></label>;

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────
function Settings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["connect", "admin", "settings"], queryFn: connectApi.admin.settings });
  const [s, setS] = useState(null);
  useEffect(() => { if (q.data && !s) setS({ ...q.data.settings, blockedWordsText: q.data.settings.blockedWords.join(", "), linkDomainsText: q.data.settings.linkDomains.join(", ") }); }, [q.data, s]);
  const save = useMutation({
    mutationFn: () => {
      const { blockedWordsText, linkDomainsText, ...rest } = s;
      return connectApi.admin.saveSettings({ ...rest, blockedWords: blockedWordsText.split(",").map((w) => w.trim()).filter((w) => w.length >= 2), linkDomains: linkDomainsText.split(",").map((w) => w.trim()).filter(Boolean) });
    },
    onSuccess: (d) => { toast.success("Settings saved"); setS({ ...d, blockedWordsText: d.blockedWords.join(", "), linkDomainsText: d.linkDomains.join(", ") }); qc.invalidateQueries({ queryKey: ["connect"] }); },
    onError: (e) => toast.error(errorOf(e)),
  });
  if (q.isLoading || !s) return <Loading rows={2} />;
  if (q.error) return <ErrorBox error={q.error} />;
  const canEdit = q.data.canEdit;
  const num = (k) => (e) => setS((x) => ({ ...x, [k]: Number(e.target.value) }));
  const flag = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.checked }));
  const educators = q.data.moderatorOptions.filter((o) => o.role === "Educator");
  const Check = ({ k, children }) => <SettingCheck checked={!!s[k]} onChange={flag(k)} disabled={!canEdit}>{children}</SettingCheck>;
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))", alignItems: "start" }}>
      <Box title="Messages">
        <Check k="directMessages">One-to-one messages between connected learners</Check>
        <label style={label} htmlFor="st-age">Youngest age for one-to-one and group messages</label>
        <input id="st-age" type="number" min={8} max={18} value={s.dmMinAge} onChange={num("dmMinAge")} disabled={!canEdit} style={{ ...input, maxWidth: 120 }} />
        <p style={{ fontSize: 12.5, color: C.muted, margin: "4px 0" }}>Younger learners chat only in their project teams. A learner with no date of birth on record counts as too young. Parents can switch messages off for their child.</p>
        <Check k="groupChats">Group chats that learners start with their connections</Check>
        <label style={label} htmlFor="st-files">Pictures and files in messages</label>
        <select id="st-files" value={s.messageFiles} onChange={(e) => setS((x) => ({ ...x, messageFiles: e.target.value }))} disabled={!canEdit} style={{ ...input, maxWidth: 320 }}>
          <option value="off">Not allowed</option><option value="team">Project team chats only</option><option value="all">All chats</option>
        </select>
      </Box>
      <Box title="Checking posts before others see them (off unless you switch it on)">
        <label style={label} htmlFor="st-new">A new member's first posts that wait for a check</label>
        <input id="st-new" type="number" min={0} max={20} value={s.reviewNewMemberPosts} onChange={num("reviewNewMemberPosts")} disabled={!canEdit} style={{ ...input, maxWidth: 120 }} />
        <Check k="reviewFiles">Every post with a picture or file waits for a check</Check>
        <Check k="reviewAll">Every learner post waits for a check</Check>
      </Box>
      <Box title="Words and links">
        <label style={label} htmlFor="st-words">Extra words to refuse (commas between)</label>
        <textarea id="st-words" rows={2} value={s.blockedWordsText} onChange={(e) => setS((x) => ({ ...x, blockedWordsText: e.target.value }))} disabled={!canEdit} style={input} />
        <p style={{ fontSize: 12.5, color: C.muted, margin: "4px 0" }}>Phone numbers, email addresses, home addresses, "meet me", other apps and a built-in list of unkind words are always refused.</p>
        <label style={label} htmlFor="st-links">Extra sites learners may link to (commas between)</label>
        <input id="st-links" value={s.linkDomainsText} onChange={(e) => setS((x) => ({ ...x, linkDomainsText: e.target.value }))} disabled={!canEdit} style={input} placeholder="e.g. mysite.org" />
      </Box>
      <Box title="Limits">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <div><label style={label} htmlFor="st-pph">Posts per hour</label><input id="st-pph" type="number" min={1} max={100} value={s.postsPerHour} onChange={num("postsPerHour")} disabled={!canEdit} style={input} /></div>
          <div><label style={label} htmlFor="st-cph">Comments per hour</label><input id="st-cph" type="number" min={1} max={300} value={s.commentsPerHour} onChange={num("commentsPerHour")} disabled={!canEdit} style={input} /></div>
          <div><label style={label} htmlFor="st-mpm">Messages per minute</label><input id="st-mpm" type="number" min={1} max={120} value={s.messagesPerMinute} onChange={num("messagesPerMinute")} disabled={!canEdit} style={input} /></div>
        </div>
      </Box>
      <Box title="Moderators">
        <p style={{ marginTop: 0, fontSize: 13.5, color: C.muted }}>Admins and staff with Digifunzi Connect access moderate everything. Educators ticked here moderate the whole of Connect from their teacher portal; community moderators are set on each community.</p>
        <div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 12, padding: 6 }}>
          {educators.map((o) => (
            <label key={o.userId} style={{ display: "flex", gap: 8, padding: "4px 6px" }}>
              <input type="checkbox" disabled={!canEdit} checked={s.moderatorUserIds.includes(o.userId)} onChange={() => setS((x) => ({ ...x, moderatorUserIds: x.moderatorUserIds.includes(o.userId) ? x.moderatorUserIds.filter((i) => i !== o.userId) : [...x.moderatorUserIds, o.userId] }))} /> {o.name}
            </label>
          ))}
          {!educators.length && <p style={{ color: C.muted, margin: 6 }}>No educators with a login yet.</p>}
        </div>
        <Check k="educatorsCreate">These educators may also create communities and challenges</Check>
      </Box>
      {canEdit && <button type="button" style={btn("primary", { justifySelf: "start" })} disabled={save.isPending} onClick={() => save.mutate()}>Save settings</button>}
    </div>
  );
}
