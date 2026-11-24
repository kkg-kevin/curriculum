import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiShield, FiUsers, FiMessageCircle, FiTool, FiSlash } from "react-icons/fi";
import { askConfirm } from "../../../components/ui/AskDialog";
import { connectApi } from "../services/connectApi";
import { HERO_GRADIENT } from "../../../theme/brand";
import { C, FONT, card, btn, pill, ErrorBox, Loading, MemberAvatar, timeAgo, errorOf, ConnectStyles, useNarrow } from "../components/kit";
import { childPath } from "../../parent/parentPaths";

// A parent's Digifunzi Connect page for one child (/parent/children/:childId/connect). Connect is
// off until the parent switches it on (Kenya's Data Protection Act asks for a parent's consent for
// a child's data). Parents see WHO their child talks to and when — never what was said (the user's
// choice, 24 Nov 2026) — and can block someone, switch messages off, or switch Connect off.
export default function ParentConnectPage() {
  const { child } = useOutletContext();
  const qc = useQueryClient();
  const narrow = useNarrow(640);
  const list = useQuery({ queryKey: ["connect", "parent", "children"], queryFn: connectApi.parent.children });
  const me = list.data?.find((c) => c.learnerId === child.id);
  const activity = useQuery({ queryKey: ["connect", "parent", "activity", child.id], queryFn: () => connectApi.parent.activity(child.id), enabled: me?.status === "active" || me?.status === "suspended" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["connect", "parent"] });
  const switches = useMutation({ mutationFn: (body) => connectApi.parent.switches(child.id, body), onSuccess: () => { toast.success("Saved"); refresh(); }, onError: (e) => toast.error(errorOf(e)) });
  const unblock = async (memberId) => { try { await connectApi.parent.unblock(child.id, memberId); refresh(); } catch (e) { toast.error(errorOf(e)); } };
  const block = async (m) => {
    if (!(await askConfirm({ title: `Block ${m.displayName} for ${child.firstName}?`, message: `They won't be able to message ${child.firstName}, and they won't see each other's posts. ${child.firstName} can't undo it — only you can.`, confirmLabel: "Block", tone: "danger" }))) return;
    try { await connectApi.parent.block(child.id, m.id); toast.success("Blocked"); refresh(); } catch (e) { toast.error(errorOf(e)); }
  };
  const switchOff = async () => {
    const ok = await askConfirm({ title: `Switch Connect off for ${child.firstName}?`, message: `${child.firstName}'s profile and posts stop showing straight away. You can switch it back on later.`, confirmLabel: "Switch off", tone: "danger" });
    if (!ok) return;
    const erase = await askConfirm({ title: "Delete what they shared too?", message: `Also delete ${child.firstName}'s posts, comments, pictures, connections and the words of their messages? This can't be undone.`, confirmLabel: "Delete it all", cancelLabel: "Keep it hidden" });
    try { await connectApi.parent.withdraw(child.id, erase); toast.success("Connect is off"); refresh(); } catch (e) { toast.error(errorOf(e)); }
  };

  if (list.isLoading) return <Loading rows={2} />;
  if (list.error) return <ErrorBox error={list.error} />;
  if (!me) return <p>Connect isn't available for this child.</p>;
  const on = me.status === "active" || me.status === "suspended";

  return (
    <div className="cx" style={{ fontFamily: FONT, color: C.ink, display: "grid", gap: narrow ? 10 : 14, width: "100%" }}>
      <ConnectStyles />
      <header style={{ background: HERO_GRADIENT, color: "#fff", borderRadius: narrow ? 16 : 20, padding: narrow ? "14px 16px" : "18px 22px" }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold }}>Digifunzi Connect</div>
        <h1 style={{ margin: "4px 0 4px", fontSize: 22 }}>{child.firstName}'s learning community</h1>
        <div style={{ opacity: 0.92, lineHeight: 1.5, fontSize: narrow ? 13.5 : 14.5 }}>
          Learners share what they make, ask for help, join interest groups (robotics, Python, games…), team up on projects and take on challenges —
          and keep the friends they made at Digifunzi after a class or bootcamp ends.
        </div>
      </header>

      {!on ? <Consent child={child} me={me} onDone={refresh} /> : (
        <>
          <section style={{ ...card, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={pill("good")}><FiShield size={12} /> On</span>
              {me.status === "suspended" && <span style={pill("waiting")}>Posting paused by a moderator until {new Date(me.suspendedUntil).toLocaleDateString("en-GB")}</span>}
              <span style={{ color: C.muted, fontSize: 13.5 }}>Others see “{me.displayName}” — never {child.firstName}'s surname, school, class or age.</span>
            </div>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 600 }}>
              <input type="checkbox" checked={me.directMessages} disabled={switches.isPending} onChange={(e) => switches.mutate({ directMessages: e.target.checked })} style={{ marginTop: 4 }} />
              <span>Allow one-to-one and group messages with learners {child.firstName} is connected with
                <span style={{ display: "block", fontSize: 13, color: C.muted, fontWeight: 400 }}>{me.dmPossible ? "Project team chats stay on either way." : `Only from age ${me.dmMinAge}${me.age == null ? " — we don't have their date of birth, so they're treated as younger" : ""}. Project team chats are always available.`}</span>
              </span>
            </label>
            <p style={{ margin: 0, fontSize: 13.5, color: C.muted }}>{child.firstName}'s Digifunzi profile photo is their Connect picture (a drawn avatar until they have one). To change it, change the photo on their profile.</p>
            <div><button type="button" style={btn("danger")} onClick={switchOff}>Switch Connect off</button></div>
          </section>

          {activity.isLoading ? <Loading rows={2} /> : activity.error ? <ErrorBox error={activity.error} /> : <Activity a={activity.data} child={child} onBlock={block} onUnblock={unblock} />}
        </>
      )}
    </div>
  );
}

function Consent({ child, me, onDone }) {
  const [agree, setAgree] = useState(false);
  const [directMessages, setDirectMessages] = useState(true);
  const consent = useMutation({
    mutationFn: () => connectApi.parent.consent(child.id, { agree: true, directMessages }),
    onSuccess: () => { toast.success(`Connect is on for ${child.firstName}`); onDone(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  return (
    <section style={{ ...card, lineHeight: 1.6 }}>
      <h2 style={{ marginTop: 0, fontSize: 19 }}>Switch Connect on for {child.firstName}</h2>
      <ul style={{ paddingLeft: 20, color: C.inkSoft }}>
        <li>{child.firstName} appears by first name and initial (they can choose a nickname) with their Digifunzi profile photo (or a drawn avatar if they have none). Their surname, school, class, age and contact details are never shown.</li>
        <li>Posts appear straight away. Phone numbers, emails, addresses and plans to meet are blocked automatically, and teachers can take anything down.</li>
        <li>One-to-one messages are only for learners aged {me.dmMinAge}+, only with people they've connected with, and you can switch them off. Younger learners chat only in project teams.</li>
        <li>You'll see who {child.firstName} connects and chats with — not what they say. Teachers read a conversation only if someone reports it.</li>
        <li>Anyone can report anything; trained staff decide. You can switch Connect off — and delete what {child.firstName} shared — at any time.</li>
      </ul>
      {!me.hasLogin ? (
        <p style={{ ...card, background: C.goldTint, borderColor: C.goldBorder, color: C.goldText }}>
          Connect is used from {child.firstName}'s own login. <Link to={childPath(child.id, "/login")} style={{ color: C.navy, fontWeight: 800 }}>Set up their login</Link> first, then come back here.
        </p>
      ) : !me.hasWorkspace ? (
        <p style={{ color: C.muted }}>{child.firstName} isn't at a Digifunzi hub yet, so Connect can't be switched on.</p>
      ) : (
        <>
          {me.dmPossible && (
            <label style={{ display: "flex", gap: 10, fontWeight: 600 }}><input type="checkbox" checked={directMessages} onChange={(e) => setDirectMessages(e.target.checked)} /> Allow messages with learners {child.firstName} connects with</label>
          )}
          <label style={{ display: "flex", gap: 10, fontWeight: 700, marginTop: 14, padding: 12, borderRadius: 12, background: C.skyTint, border: `1px solid ${C.skyBorder}` }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I'm {child.firstName}'s parent or guardian. I agree to {child.firstName} using Digifunzi Connect and to Digifunzi keeping what they share there, as described above.
          </label>
          <button type="button" style={btn("primary", { marginTop: 12 })} disabled={!agree || consent.isPending} onClick={() => consent.mutate()}>Switch Connect on</button>
        </>
      )}
    </section>
  );
}

function Activity({ a, child, onBlock, onUnblock }) {
  const blockedIds = new Set(a.blocks.filter((b) => b.kind === "block").map((b) => b.member?.id));
  const Person = ({ m, extra }) => (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
      <MemberAvatar card={m} size={32} />
      <strong style={{ flex: 1 }}>{m?.displayName}</strong>
      {extra}
      {m?.id && !blockedIds.has(m.id) && <button type="button" style={btn("link", { color: C.danger })} onClick={() => onBlock(m)}><FiSlash /> Block</button>}
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}><FiMessageCircle /> Chats</h3>
        <p style={{ marginTop: 0, fontSize: 13, color: C.muted }}>Who {child.firstName} chats with and when — not what was said.</p>
        {a.conversations.length ? a.conversations.map((c) => (
          <div key={c.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={pill(c.kind === "project" ? "waiting" : c.kind === "group" ? "info" : "strong")}>{c.kind === "project" ? "Project team" : c.kind === "group" ? "Group" : "One-to-one"}</span>
              <strong>{c.kind === "direct" ? c.with[0]?.displayName : c.title || c.with.map((w) => w.displayName).join(", ")}</strong>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted }}>{c.with.length} other{c.with.length === 1 ? "" : "s"} · {c.sentByChild} sent by {child.firstName} · last message {c.lastMessageAt ? timeAgo(c.lastMessageAt) : "none yet"}</div>
            {c.kind !== "project" && c.with.map((w) => !blockedIds.has(w.id) && <button key={w.id} type="button" style={btn("link", { color: C.danger, fontSize: 12.5 })} onClick={() => onBlock(w)}>Block {w.displayName}</button>)}
          </div>
        )) : <p style={{ color: C.muted }}>No chats yet.</p>}
      </section>
      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}><FiUsers /> Connections</h3>
        {a.connections.length ? a.connections.map((c) => <Person key={c.member?.id} m={c.member} extra={<span style={{ fontSize: 12, color: C.muted }}>since {new Date(c.since).toLocaleDateString("en-GB")}</span>} />) : <p style={{ color: C.muted }}>No connections yet.</p>}
      </section>
      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Communities and projects</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{a.communities.map((c) => <span key={c.slug} style={pill("strong")}>{c.name}</span>)}</div>
        {!a.communities.length && <p style={{ color: C.muted, margin: 0 }}>No communities yet.</p>}
        <div style={{ marginTop: 10 }}>{a.projects.map((p) => <div key={p.id} style={{ padding: "4px 0" }}><FiTool /> {p.title} <span style={pill("neutral")}>{p.role === "owner" ? "Leads it" : "Team member"}</span></div>)}</div>
        <p style={{ fontSize: 13, color: C.muted }}>{a.postCount} post{a.postCount === 1 ? "" : "s"} shared.</p>
      </section>
      {a.blocks.length > 0 && (
        <section style={card}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}><FiSlash /> Blocked and muted</h3>
          {a.blocks.map((b) => (
            <div key={`${b.kind}${b.member?.id}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0" }}>
              <MemberAvatar card={b.member} size={28} /><span style={{ flex: 1 }}>{b.member?.displayName}</span>
              <span style={pill(b.kind === "block" ? "danger" : "neutral")}>{b.kind === "block" ? "Blocked" : "Muted"}{b.byParent ? " by you" : ` by ${child.firstName}`}</span>
              {b.byParent && <button type="button" style={btn("link")} onClick={() => onUnblock(b.member.id)}>Unblock</button>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
