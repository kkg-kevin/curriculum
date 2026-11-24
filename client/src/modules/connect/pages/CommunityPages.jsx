import { useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiSearch, FiShield } from "react-icons/fi";
import { askConfirm } from "../../../components/ui/AskDialog";
import { connectApi } from "../services/connectApi";
import { C, card, btn, pill, input, Chip, Empty, ErrorBox, Loading, MemberAvatar, IconFor, PlainText, errorOf, useNarrow } from "../components/kit";
import { Composer } from "../components/posts";
import { CommunityTile, PostList, usePostPages, useMyCommunities } from "./FeedPages";
import { CONNECT_BASE } from "./ConnectLayout";

const base = CONNECT_BASE;

export function CommunitiesPage() {
  const [params, setParams] = useSearchParams();
  const all = params.get("all") === "1";
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["connect", "communities", "all", q], queryFn: () => connectApi.communities({ q }) });
  const shown = (list.data || []).filter((c) => all || c.myStatus === "active" || c.myStatus === "invited" || c.myStatus === "pending");
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Chip active={!all} onClick={() => setParams({})}>My communities</Chip>
        <Chip active={all} onClick={() => setParams({ all: "1" })}>Browse all</Chip>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <FiSearch style={{ position: "absolute", left: 12, top: 12, color: C.faint }} />
          <input aria-label="Search communities" placeholder="Search communities" value={q} onChange={(e) => { setQ(e.target.value); if (!all) setParams({ all: "1" }); }} style={{ ...input, paddingLeft: 34 }} />
        </div>
      </div>
      {list.isLoading ? <Loading rows={2} /> : list.error ? <ErrorBox error={list.error} /> : shown.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {shown.map((c) => <CommunityTile key={c.id} c={c} />)}
        </div>
      ) : (
        <Empty icon="users" title={all ? "No communities match" : "You haven't joined a community yet"}
          action={!all && <button type="button" style={btn("primary")} onClick={() => setParams({ all: "1" })}>Find communities</button>}>
          {all ? "Try another word." : "Communities are groups for things you love — Python, robots, games and more. Anyone from any class can join."}
        </Empty>
      )}
    </div>
  );
}

export function CommunityPage() {
  const { me } = useOutletContext();
  const { slug } = useParams();
  const qc = useQueryClient();
  const narrow = useNarrow(980);
  const c = useQuery({ queryKey: ["connect", "community", slug], queryFn: () => connectApi.community(slug) });
  const mine = useMyCommunities();
  const [category, setCategory] = useState("");
  const query = usePostPages(["community", c.data?.id, category], (param) => connectApi.communityPosts(c.data.id, { category, ...(param || {}) }), !!c.data?.id && !!c.data?.canSee);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["connect", "community", slug] }); qc.invalidateQueries({ queryKey: ["connect", "communities"] }); };
  const join = useMutation({ mutationFn: () => connectApi.join(c.data.id), onSuccess: (r) => { toast.success(r.myStatus === "pending" ? "Asked to join" : "Welcome!"); refresh(); }, onError: (e) => toast.error(errorOf(e)) });
  const leave = async () => {
    if (!(await askConfirm({ title: `Leave ${c.data.name}?`, message: "You can join again any time.", confirmLabel: "Leave" }))) return;
    try { await connectApi.leave(c.data.id); refresh(); } catch (e) { toast.error(errorOf(e)); }
  };
  if (c.isLoading) return <Loading rows={2} />;
  if (c.error) return <ErrorBox error={c.error} />;
  const d = c.data;
  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 16 }}>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <div style={{ ...card, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderTop: `6px solid ${d.color}` }}>
          <span style={{ width: 60, height: 60, borderRadius: 18, background: d.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><IconFor name={d.icon} size={28} /></span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>{d.name}</h1>
            <div style={{ color: C.muted, fontSize: 13.5 }}>{d.memberCount} members · {d.postCount} posts{d.joinMode === "approval" ? " · joining needs a yes" : ""}{d.postingMode === "moderators" ? " · moderators post here" : ""}</div>
          </div>
          {d.myStatus === "active" ? <button type="button" style={btn("ghost")} onClick={leave}>Leave</button>
            : d.myStatus === "pending" ? <span style={pill("waiting")}>Waiting for a yes</span>
              : <button type="button" style={btn("gold")} onClick={() => join.mutate()} disabled={join.isPending}>{d.myStatus === "invited" ? "Accept invitation" : d.joinMode === "approval" ? "Ask to join" : "Join"}</button>}
        </div>
        {d.canPost && me.status === "active" && <Composer me={me} communityId={d.id} placeholder={`Share with ${d.name}…`} />}
        {d.canSee ? (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip active={!category} onClick={() => setCategory("")}>All</Chip>
              {(me.catalogue?.categories || []).map((cat) => <Chip key={cat.key} active={category === cat.key} onClick={() => setCategory(cat.key)}>{cat.label}</Chip>)}
            </div>
            {d.id && <PostList query={query} me={me} communities={mine.data || []} emptyText={d.myStatus === "active" ? "Start the conversation!" : "Join to post here."} />}
          </>
        ) : <Empty icon="shield" title="Members only">Ask to join to see what members share here.</Empty>}
      </div>
      <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <section style={card}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>About</h3>
          <PlainText style={{ color: C.inkSoft }}>{d.description || "A Digifunzi community."}</PlainText>
          {d.topics?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>{d.topics.map((t) => <span key={t} style={pill("info")}>{me.catalogue.interests.find((i) => i.key === t)?.label || t}</span>)}</div>}
        </section>
        <section style={card}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}><FiShield style={{ verticalAlign: -2 }} /> Moderators</h3>
          {d.moderators.length ? d.moderators.map((m, i) => <div key={i} style={{ fontWeight: 700, padding: "3px 0" }}>{m.name}</div>) : <p style={{ color: C.muted, margin: 0 }}>Digifunzi's teachers look after this community.</p>}
        </section>
        <section style={card}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Members</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {d.members.map((m) => <Link key={m.id} to={`${base}/people/${m.id}`} title={m.displayName}><MemberAvatar card={m} size={38} /></Link>)}
          </div>
          {!d.members.length && <p style={{ color: C.muted, margin: 0 }}>No members yet — be the first!</p>}
        </section>
      </aside>
    </div>
  );
}
