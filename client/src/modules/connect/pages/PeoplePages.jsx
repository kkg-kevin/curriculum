import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiUserPlus, FiUserCheck, FiMessageCircle, FiSearch, FiAward, FiShield, FiTool, FiEdit2, FiCheck, FiStar } from "react-icons/fi";
import { askConfirm } from "../../../components/ui/AskDialog";
import { connectApi, mediaUrl } from "../services/connectApi";
import { C, card, btn, pill, input, label, Chip, Chips, Empty, ErrorBox, Loading, MemberAvatar, IconFor, ReportDialog, MoreMenu, PlainText, errorOf, useNarrow } from "../components/kit";
import { PostList, usePostPages, labelOf } from "./FeedPages";
import { CONNECT_BASE } from "./ConnectLayout";

const base = CONNECT_BASE;
const TABS = [{ key: "discover", label: "Find people" }, { key: "requests", label: "Requests" }, { key: "connections", label: "My connections" }, { key: "blocked", label: "Blocked & muted" }];

export function PeoplePage() {
  const { me } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "discover";
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((t) => <Chip key={t.key} active={tab === t.key} onClick={() => setParams({ tab: t.key })}>{t.label}{t.key === "requests" && me.counts?.connectionRequests ? ` (${me.counts.connectionRequests})` : ""}</Chip>)}
      </div>
      {tab === "discover" && <Discover me={me} />}
      {(tab === "requests" || tab === "connections") && <Connections tab={tab} />}
      {tab === "blocked" && <Blocked />}
    </div>
  );
}

function Discover({ me }) {
  const [q, setQ] = useState("");
  const [interest, setInterest] = useState("");
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ["connect", "people", q, interest, page], queryFn: () => connectApi.people({ q, interest, page }), placeholderData: (prev) => prev });
  return (
    <>
      <div style={{ position: "relative" }}>
        <FiSearch style={{ position: "absolute", left: 12, top: 12, color: C.faint }} />
        <input aria-label="Search people" placeholder="Search by name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ ...input, paddingLeft: 34 }} />
      </div>
      <Chips options={me.catalogue.interests} value={interest} onChange={(v) => { setInterest(v); setPage(1); }} all="Any interest" />
      {list.isLoading ? <Loading rows={2} /> : list.error ? <ErrorBox error={list.error} /> : list.data.items.length ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {list.data.items.map((p) => (
              <Link key={p.id} to={`${base}/people/${p.id}`} style={{ ...card, textDecoration: "none", color: C.ink, display: "grid", gap: 8, justifyItems: "center", textAlign: "center" }}>
                <MemberAvatar card={p} size={64} />
                <strong>{p.displayName}</strong>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                  {p.interests.slice(0, 3).map((k) => <span key={k} style={pill(p.shared.includes(k) ? "good" : "neutral")}>{labelOf(me, k)}</span>)}
                </div>
                {p.connection?.status === "accepted" && <span style={pill("good")}><FiUserCheck size={11} /> Connected</span>}
              </Link>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {page > 1 && <button type="button" style={btn("ghost")} onClick={() => setPage((n) => n - 1)}>Back</button>}
            {list.data.hasMore && <button type="button" style={btn("ghost")} onClick={() => setPage((n) => n + 1)}>More people</button>}
          </div>
        </>
      ) : <Empty icon="users" title="Nobody found">Try another interest or name.</Empty>}
    </>
  );
}

function Connections({ tab }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["connect", "connections"], queryFn: connectApi.connections });
  const answer = useMutation({
    mutationFn: ({ id, accept }) => connectApi.respondConnection(id, accept),
    onSuccess: (r) => { toast.success(r.status === "accepted" ? "You're connected!" : "Request declined"); qc.invalidateQueries({ queryKey: ["connect"] }); },
    onError: (e) => toast.error(errorOf(e)),
  });
  if (list.isLoading) return <Loading rows={2} />;
  if (list.error) return <ErrorBox error={list.error} />;
  const rows = tab === "requests" ? list.data.incoming : list.data.connections;
  if (!rows.length && !(tab === "requests" && list.data.outgoing.length)) {
    return <Empty icon="users" title={tab === "requests" ? "No requests" : "No connections yet"}>{tab === "requests" ? "When someone wants to connect, it shows here." : "Find people who like what you like and send them a request."}</Empty>;
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => (
        <div key={r.id} style={{ ...card, display: "flex", gap: 10, alignItems: "center", padding: 12 }}>
          <MemberAvatar card={r.member} size={40} />
          <Link to={`${base}/people/${r.member?.id}`} style={{ flex: 1, fontWeight: 800, color: C.ink }}>{r.member?.displayName}</Link>
          {tab === "requests" ? <>
            <button type="button" style={btn("primary")} onClick={() => answer.mutate({ id: r.id, accept: true })}>Accept</button>
            <button type="button" style={btn("ghost")} onClick={() => answer.mutate({ id: r.id, accept: false })}>Decline</button>
          </> : <span style={pill("good")}>Connected</span>}
        </div>
      ))}
      {tab === "requests" && list.data.outgoing.length > 0 && (
        <p style={{ color: C.muted, fontSize: 13.5 }}>Waiting for: {list.data.outgoing.map((r) => r.member?.displayName).join(", ")}</p>
      )}
    </div>
  );
}

function Blocked() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["connect", "blocks"], queryFn: connectApi.blocks });
  const undo = async (row) => {
    try { await (row.kind === "block" ? connectApi.block(row.member.id, false) : connectApi.mute(row.member.id, false)); qc.invalidateQueries({ queryKey: ["connect"] }); } catch (e) { toast.error(errorOf(e)); }
  };
  if (list.isLoading) return <Loading rows={1} />;
  if (!list.data?.length) return <Empty icon="shield" title="Nobody blocked or muted">Blocking someone stops them messaging you and hides their posts. Muting just hides their posts from your feed.</Empty>;
  return list.data.map((r) => (
    <div key={`${r.kind}${r.member?.id}`} style={{ ...card, display: "flex", gap: 10, alignItems: "center", padding: 12 }}>
      <MemberAvatar card={r.member} size={36} />
      <strong style={{ flex: 1 }}>{r.member?.displayName}</strong>
      <span style={pill(r.kind === "block" ? "danger" : "neutral")}>{r.kind === "block" ? "Blocked" : "Muted"}{r.byParent ? " by your parent" : ""}</span>
      {!r.byParent && <button type="button" style={btn("ghost")} onClick={() => undo(r)}>{r.kind === "block" ? "Unblock" : "Unmute"}</button>}
    </div>
  ));
}

// ── Someone's profile ────────────────────────────────────────────────────────────────────────────
export function PersonPage() {
  const { me } = useOutletContext();
  const { memberId } = useParams();
  if (memberId === me.profile?.id) return <MyProfilePage />;
  return <Profile memberId={memberId} me={me} />;
}

function Profile({ memberId, me }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const narrow = useNarrow(900);
  const [reporting, setReporting] = useState(false);
  const p = useQuery({ queryKey: ["connect", "person", memberId], queryFn: () => connectApi.person(memberId) });
  const posts = usePostPages(["member", memberId], (param) => connectApi.personPosts(memberId, param?.cursor));
  const refresh = () => qc.invalidateQueries({ queryKey: ["connect"] });
  const act = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); refresh(); } catch (e) { toast.error(errorOf(e)); } };
  const message = async () => { try { const r = await connectApi.startConversation({ memberIds: [memberId] }); navigate(`${base}/messages/${r.id}`); } catch (e) { toast.error(errorOf(e)); } };
  if (p.isLoading) return <Loading rows={2} />;
  if (p.error) return <ErrorBox error={p.error} />;
  const d = p.data;
  const conn = d.connection;
  const active = me.status === "active";
  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0, 1fr) minmax(0, 1.6fr)", gap: 16 }}>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <section style={{ ...card, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }}>
          <MemberAvatar card={d} size={96} />
          <h1 style={{ margin: 0, fontSize: 24 }}>{d.displayName}</h1>
          <div style={{ fontSize: 13, color: C.muted }}>On Connect since {new Date(d.joinedAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
          {d.bio && <PlainText style={{ color: C.inkSoft }}>{d.bio}</PlainText>}
          {active && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
              {d.blocked ? <button type="button" style={btn("ghost")} onClick={() => act(() => connectApi.block(memberId, false), "Unblocked")}>Unblock</button> : <>
                {!conn && <button type="button" style={btn("primary")} onClick={() => act(() => connectApi.connect(memberId), "Request sent")}><FiUserPlus /> Connect</button>}
                {conn?.status === "pending" && conn.direction === "outgoing" && <span style={pill("waiting")}>Request sent</span>}
                {conn?.status === "pending" && conn.direction === "incoming" && <button type="button" style={btn("primary")} onClick={() => act(() => connectApi.respondConnection(conn.id, true), "You're connected!")}><FiUserCheck /> Accept request</button>}
                {conn?.status === "accepted" && <span style={pill("good")}><FiUserCheck size={11} /> Connected</span>}
                {!d.messageBlocker ? <button type="button" style={btn("soft")} onClick={message}><FiMessageCircle /> Message</button> : null}
              </>}
              <MoreMenu items={[
                conn?.status === "accepted" && { label: "Remove connection", onClick: async () => { if (await askConfirm({ title: "Remove this connection?", confirmLabel: "Remove" })) act(() => connectApi.disconnect(memberId)); } },
                { label: d.muted ? "Unmute" : "Mute (hide their posts)", onClick: () => act(() => connectApi.mute(memberId, !d.muted), d.muted ? "Unmuted" : "Muted") },
                !d.blocked && { label: "Block", danger: true, onClick: async () => { if (await askConfirm({ title: `Block ${d.displayName}?`, message: "They won't be able to message you, and you won't see each other's posts. They aren't told.", confirmLabel: "Block", tone: "danger" })) act(() => connectApi.block(memberId, true), "Blocked"); } },
                { label: "Report", onClick: () => setReporting(true) },
              ]} />
            </div>
          )}
          {d.messageBlocker && !d.blocked && <div style={{ fontSize: 12.5, color: C.muted }}>{d.messageBlocker}</div>}
        </section>
        <ProfileFacts d={d} me={me} />
      </div>
      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Posts</h2>
        <PostList query={posts} me={me} emptyText={`${d.displayName} hasn't posted yet.`} />
      </div>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="member" targetId={memberId} reasons={me.catalogue?.reportReasons || []} what={d.displayName} />
    </div>
  );
}

function ProfileFacts({ d, me }) {
  return (
    <>
      {(d.interests.length > 0 || d.skills.length > 0) && (
        <section style={card}>
          {d.interests.length > 0 && <><h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Into</h3><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{d.interests.map((k) => <span key={k} style={pill("info")}>{labelOf(me, k)}</span>)}</div></>}
          {d.skills.length > 0 && <><h3 style={{ margin: "12px 0 8px", fontSize: 15 }}>Good at</h3><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{d.skills.map((k) => <span key={k} style={pill("strong")}>{labelOf(me, k)}</span>)}</div></>}
        </section>
      )}
      {(d.badges.length > 0 || d.classBadges.length > 0) && (
        <section style={card}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}><FiAward /> Badges</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
            {[...d.badges, ...d.classBadges].map((b) => (
              <div key={b.key} title={b.description} style={{ textAlign: "center", padding: 10, borderRadius: 14, background: C.goldTint, border: `1px solid ${C.goldBorder}` }}>
                <span style={{ width: 38, height: 38, borderRadius: "50%", background: C.gold, color: C.navyDeep, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconFor name={b.icon} size={18} /></span>
                <div style={{ fontWeight: 800, fontSize: 12.5, marginTop: 4, color: C.goldText }}>{b.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      {d.certificates?.length > 0 && (
        <section style={card}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}><FiStar /> Completed</h3>
          {d.certificates.map((c) => <div key={c.id} style={{ padding: "5px 0", fontWeight: 700 }}>{c.title} <span style={pill("neutral")}>{c.kindLabel}</span></div>)}
        </section>
      )}
      {d.communities.length > 0 && (
        <section style={card}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Communities</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{d.communities.map((c) => <Link key={c.id} to={`${base}/communities/${c.slug}`} style={{ ...pill("strong"), textDecoration: "none" }}>{c.name}</Link>)}</div>
        </section>
      )}
      {d.projects.length > 0 && (
        <section style={card}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}><FiTool /> Projects</h3>
          {d.projects.map((p) => (
            <Link key={p.id} to={`${base}/projects/${p.id}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", textDecoration: "none", color: C.ink }}>
              {p.cover ? <img src={mediaUrl(p.cover.url)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} /> : <span style={{ width: 40, height: 40, borderRadius: 8, background: C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><FiTool /></span>}
              <span style={{ fontWeight: 800 }}>{p.title}</span>{p.showcased && <span style={pill("waiting")}>Showcase</span>}
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

// ── My profile ───────────────────────────────────────────────────────────────────────────────────
export function MyProfilePage() {
  const { me } = useOutletContext();
  const qc = useQueryClient();
  const narrow = useNarrow(900);
  const [editing, setEditing] = useState(false);
  const p = useQuery({ queryKey: ["connect", "person", me.profile.id], queryFn: () => connectApi.person(me.profile.id) });
  const posts = usePostPages(["mine"], (param) => connectApi.posts({ scope: "mine", ...(param || {}) }));
  if (p.isLoading) return <Loading rows={2} />;
  if (p.error) return <ErrorBox error={p.error} />;
  const d = p.data;
  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0, 1fr) minmax(0, 1.6fr)", gap: 16 }}>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <section style={{ ...card, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }}>
          <MemberAvatar card={me.profile} size={96} />
          <h1 style={{ margin: 0, fontSize: 24 }}>{me.profile.displayName}</h1>
          {me.profile.bio ? <PlainText style={{ color: C.inkSoft }}>{me.profile.bio}</PlainText> : <span style={{ color: C.muted }}>Add a few words about you.</span>}
          {me.status === "active" && <button type="button" style={btn("primary")} onClick={() => setEditing(true)}><FiEdit2 /> Edit my profile</button>}
          <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}><FiShield style={{ verticalAlign: -2 }} /> Others see this name and picture — never your surname, school, class or age.</p>
        </section>
        <ProfileFacts d={d} me={me} />
      </div>
      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
        {editing ? <ProfileEditor me={me} onDone={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["connect"] }); }} /> : <>
          <h2 style={{ margin: 0, fontSize: 18 }}>My posts</h2>
          <PostList query={posts} me={me} emptyText="Your posts show here." />
        </>}
      </div>
    </div>
  );
}

function ProfileEditor({ me, onDone }) {
  const pr = me.profile;
  const [displayName, setDisplayName] = useState(pr.displayName);
  const [bio, setBio] = useState(pr.bio || "");
  const [interests, setInterests] = useState(pr.interests || []);
  const [skills, setSkills] = useState(pr.skills || []);
  const [avatar, setAvatar] = useState({ icon: pr.avatarChoice?.icon, color: pr.avatarChoice?.color });
  const [showCertificates, setShowCertificates] = useState(pr.showCertificates);
  const save = useMutation({
    mutationFn: () => connectApi.updateProfile({ displayName, bio, interests, skills, avatar, showCertificates }),
    onSuccess: () => { toast.success("Profile saved"); onDone(); },
    onError: (e) => toast.error(errorOf(e, "Couldn't save")),
  });
  const toggle = (list, setList, max) => (k) => setList(list.includes(k) ? list.filter((x) => x !== k) : [...list, k].slice(0, max));
  return (
    <section style={card}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Edit my profile</h2>
      <label style={label} htmlFor="pe-name">Name others see</label>
      <input id="pe-name" maxLength={30} value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={input} />
      <p style={{ fontSize: 12.5, color: C.muted, margin: "4px 0 0" }}>Use your first name or a nickname — never your full name.</p>
      <span style={label}>Picture</span>
      {pr.hasPhoto ? (
        <p style={{ display: "flex", gap: 10, alignItems: "center", margin: 0, color: C.muted, fontSize: 13.5 }}>
          <MemberAvatar card={pr} size={44} /> Your profile photo is your Connect picture. Change it on your Profile page.
        </p>
      ) : (<>
      <p style={{ margin: "0 0 6px", color: C.muted, fontSize: 13 }}>Add a photo on your Profile page to use it here — until then, pick an avatar.</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {me.catalogue.avatarIcons.map((icon) => (
          <button key={icon} type="button" aria-label={icon} aria-pressed={avatar.icon === icon} onClick={() => setAvatar((a) => ({ icon, color: a.color || me.catalogue.avatarColors[0] }))} style={{ border: `2px solid ${avatar.icon === icon ? C.gold : "transparent"}`, borderRadius: "50%", padding: 2, background: "none", cursor: "pointer" }}>
            <MemberAvatar card={{ avatar: { icon, color: avatar.color || C.navy } }} size={36} />
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {me.catalogue.avatarColors.map((color) => (
          <button key={color} type="button" aria-label={`Colour ${color}`} onClick={() => setAvatar((a) => ({ icon: a.icon || "smile", color }))} style={{ width: 28, height: 28, borderRadius: "50%", background: color, border: `3px solid ${avatar.color === color ? C.gold : "#fff"}`, boxShadow: `0 0 0 1px ${C.border}`, cursor: "pointer" }}>{avatar.color === color && <FiCheck color="#fff" />}</button>
        ))}
      </div>
      </>)}
      <label style={label} htmlFor="pe-bio">About me</label>
      <textarea id="pe-bio" rows={3} maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} style={input} placeholder="What do you like making? What do you want to learn?" />
      <span style={label}>I'm into (up to 8)</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{me.catalogue.interests.map((i) => <Chip key={i.key} active={interests.includes(i.key)} onClick={() => toggle(interests, setInterests, 8)(i.key)}>{i.label}</Chip>)}</div>
      <span style={label}>I'm good at (up to 6)</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{me.catalogue.interests.map((i) => <Chip key={i.key} active={skills.includes(i.key)} onClick={() => toggle(skills, setSkills, 6)(i.key)}>{i.label}</Chip>)}</div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontWeight: 700 }}>
        <input type="checkbox" checked={showCertificates} onChange={(e) => setShowCertificates(e.target.checked)} /> Show the courses and bootcamps I've completed
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" style={btn("primary")} disabled={save.isPending} onClick={() => save.mutate()}>Save</button>
        <button type="button" style={btn("ghost")} onClick={onDone}>Cancel</button>
      </div>
    </section>
  );
}

// ── Staying safe ─────────────────────────────────────────────────────────────────────────────────
export function RulesPage() {
  const rules = [
    ["Be kind", "Say things you'd be happy for your teacher and family to read. Help people, don't make fun of them."],
    ["Keep private things private", "Never share your phone number, email, home address, school, or where you'll be. Connect stops most of these anyway."],
    ["Stay on Connect", "Don't ask people to talk on other apps. Everything here is looked after by Digifunzi's teachers."],
    ["Never meet up", "Don't arrange to meet anyone you know only from Connect. If someone asks, tell a grown-up and report it."],
    ["Share your own work", "Only post pictures and projects that are yours (or your team's). Don't post photos of other people."],
    ["Tell someone", "If anything makes you feel worried or uncomfortable, use Report and tell a grown-up you trust. You won't be in trouble."],
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Link to={base} style={btn("link")}>← Back to Connect</Link>
      <section style={card}>
        <h1 style={{ marginTop: 0, fontSize: 24 }}><FiShield style={{ verticalAlign: -3 }} /> Staying safe on Connect</h1>
        <p style={{ color: C.muted, lineHeight: 1.6 }}>Connect is for Digifunzi learners to learn, build and share together. Teachers look after it, and your parent chose to switch it on for you.</p>
        {rules.map(([title, text], i) => (
          <div key={title} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: `1px solid ${C.line}` }}>
            <span style={{ width: 32, height: 32, borderRadius: "50%", background: C.gold, color: C.navyDeep, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, flexShrink: 0 }}>{i + 1}</span>
            <div><strong>{title}</strong><div style={{ color: C.inkSoft, lineHeight: 1.5 }}>{text}</div></div>
          </div>
        ))}
        <p style={{ color: C.muted, fontSize: 13.5, marginBottom: 0 }}>Posts that break these rules are taken down. Breaking them again can mean a break from posting and messages.</p>
      </section>
    </div>
  );
}
