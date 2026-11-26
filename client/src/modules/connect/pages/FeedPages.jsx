import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiArrowRight, FiUsers, FiFlag, FiStar, FiUserPlus, FiVolume2 } from "react-icons/fi";
import { announcementsApi } from "../../announcements/services/announcementsApi";
import { connectApi, mediaUrl } from "../services/connectApi";
import { C, FONT, card, btn, pill, Chips, Empty, ErrorBox, Loading, MemberAvatar, SectionTitle, IconFor, errorOf, useNarrow } from "../components/kit";
import { Composer, PostCard, Comments } from "../components/posts";
import { CONNECT_BASE } from "./ConnectLayout";

const base = CONNECT_BASE;

export const useMyCommunities = (enabled = true) => useQuery({ queryKey: ["connect", "communities", "mine"], queryFn: () => connectApi.communities({ mine: 1 }), enabled });

// ── Discover ─────────────────────────────────────────────────────────────────────────────────────
export function DiscoverPage() {
  const { me } = useOutletContext();
  const narrow = useNarrow(980);
  const communities = useQuery({ queryKey: ["connect", "communities", "all"], queryFn: () => connectApi.communities() });
  const people = useQuery({ queryKey: ["connect", "people", "discover"], queryFn: () => connectApi.people({}) });
  const challenges = useQuery({ queryKey: ["connect", "challenges", "current"], queryFn: () => connectApi.challenges("current") });
  const showcase = useQuery({ queryKey: ["connect", "projects", "showcase"], queryFn: () => connectApi.projects({ view: "showcase" }) });
  const latest = useQuery({ queryKey: ["connect", "posts", "feed", "", "new", "discover"], queryFn: () => connectApi.posts({}) });
  const suggested = (communities.data || []).filter((c) => c.suggested).slice(0, 4);
  const others = (communities.data || []).filter((c) => !c.myStatus && !c.suggested).slice(0, 4 - Math.min(suggested.length, 4));
  const profile = me.profile;
  const needsInterests = !profile.interests?.length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 16 }}>
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <div style={{ ...card, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <MemberAvatar card={profile} size={56} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Hi {profile.displayName}!</div>
            <div style={{ color: C.muted }}>{needsInterests ? "Tell Connect what you're into and we'll find your people." : "Here's what's happening in your Digifunzi community."}</div>
          </div>
          {needsInterests ? <Link to={`${base}/profile`} style={{ ...btn("gold"), textDecoration: "none" }}>Pick my interests</Link> : <Link to={`${base}/feed`} style={{ ...btn("primary"), textDecoration: "none" }}>Open the feed <FiArrowRight /></Link>}
        </div>

        <section>
          <SectionTitle right={<Link to={`${base}/communities?all=1`} style={btn("link")}>All communities</Link>}><FiUsers style={{ verticalAlign: -3 }} /> Communities for you</SectionTitle>
          {communities.isLoading ? <Loading rows={1} /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {[...suggested, ...others].map((c) => <CommunityTile key={c.id} c={c} />)}
              {!suggested.length && !others.length && <Empty icon="users" title="You're in every community!" />}
            </div>
          )}
        </section>

        <section>
          <SectionTitle right={<Link to={`${base}/feed`} style={btn("link")}>See all</Link>}>Latest posts</SectionTitle>
          {latest.isLoading ? <Loading /> : latest.error ? <ErrorBox error={latest.error} /> : (latest.data.items || []).slice(0, 4).map((p) => <div key={p.id} style={{ marginBottom: 10 }}><PostCard post={p} me={me} base={base} /></div>)}
          {latest.data && !latest.data.items.length && <Empty icon="edit-3" title="Nothing here yet" action={<Link to={`${base}/feed`} style={{ ...btn("primary"), textDecoration: "none" }}>Write the first post</Link>}>Share something you made or ask a question.</Empty>}
        </section>
      </div>

      <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <section style={card}>
          <SectionTitle right={<Link to={`${base}/people`} style={btn("link")}>More</Link>}><FiUserPlus style={{ verticalAlign: -3 }} /> People like you</SectionTitle>
          {people.isLoading ? "Loading…" : (people.data?.items || []).slice(0, 5).map((p) => (
            <Link key={p.id} to={`${base}/people/${p.id}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", textDecoration: "none", color: C.ink, borderBottom: `1px solid ${C.line}` }}>
              <MemberAvatar card={p} size={36} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{p.displayName}</div>
                <div style={{ fontSize: 12.5, color: C.muted }}>{p.shared.length ? `Also into ${p.shared.map((k) => labelOf(me, k)).slice(0, 2).join(", ")}` : "On Connect"}</div>
              </div>
            </Link>
          ))}
          {people.data && !people.data.items.length && <p style={{ color: C.muted, margin: 0 }}>When more learners join, they'll show up here.</p>}
        </section>

        <section style={card}>
          <SectionTitle right={<Link to={`${base}/challenges`} style={btn("link")}>All</Link>}><FiFlag style={{ verticalAlign: -3 }} /> Open challenges</SectionTitle>
          {(challenges.data || []).slice(0, 3).map((c) => (
            <Link key={c.id} to={`${base}/challenges/${c.id}`} style={{ display: "block", padding: "9px 0", textDecoration: "none", color: C.ink, borderBottom: `1px solid ${C.line}` }}>
              <div style={{ fontWeight: 800 }}>{c.title}</div>
              <div style={{ fontSize: 12.5, color: C.muted }}>{c.endsOn ? `Until ${c.endsOn}` : "Open now"} · {c.entries} taking part {c.myEntry && <span style={pill("good")}>You're in</span>}</div>
            </Link>
          ))}
          {challenges.data && !challenges.data.length && <p style={{ color: C.muted, margin: 0 }}>No challenges right now — watch this space.</p>}
        </section>

        <section style={card}>
          <SectionTitle right={<Link to={`${base}/projects?view=showcase`} style={btn("link")}>Showcase</Link>}><FiStar style={{ verticalAlign: -3 }} /> Made by learners</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(showcase.data?.items || []).slice(0, 4).map((p) => (
              <Link key={p.id} to={`${base}/projects/${p.id}`} style={{ textDecoration: "none", color: C.ink }}>
                {p.cover ? <img src={mediaUrl(p.cover.url)} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12 }} /> : <div style={{ aspectRatio: "4 / 3", borderRadius: 12, background: C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><IconFor name="tool" size={26} /></div>}
                <div style={{ fontWeight: 800, fontSize: 13.5, marginTop: 4 }}>{p.title}</div>
              </Link>
            ))}
          </div>
          {showcase.data && !showcase.data.items.length && <p style={{ color: C.muted, margin: 0 }}>Finished projects shown off by their teams appear here.</p>}
        </section>
      </aside>
    </div>
  );
}

export const labelOf = (me, key) => me.catalogue?.interests?.find((i) => i.key === key)?.label || key;

export function CommunityTile({ c }) {
  const qc = useQueryClient();
  const join = useMutation({
    mutationFn: () => connectApi.join(c.id),
    onSuccess: (r) => { toast.success(r.myStatus === "pending" ? "Asked to join — a moderator will say yes soon." : `You joined ${c.name}!`); qc.invalidateQueries({ queryKey: ["connect", "communities"] }); },
    onError: (err) => toast.error(errorOf(err)),
  });
  return (
    <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <Link to={`${base}/communities/${c.slug}`} style={{ display: "flex", gap: 10, alignItems: "center", textDecoration: "none", color: C.ink }}>
        <span style={{ width: 42, height: 42, borderRadius: 14, background: c.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconFor name={c.icon} size={20} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, lineHeight: 1.2 }}>{c.name}</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>{c.memberCount} member{c.memberCount === 1 ? "" : "s"}{c.suggested ? " · for you" : ""}</div>
        </div>
      </Link>
      <p style={{ margin: 0, fontSize: 13.5, color: C.inkSoft, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.description}</p>
      {c.myStatus === "active" ? <span style={pill("good", { alignSelf: "flex-start" })}>Member</span>
        : c.myStatus === "pending" ? <span style={pill("waiting", { alignSelf: "flex-start" })}>Asked to join</span>
          : <button type="button" style={btn(c.myStatus === "invited" ? "gold" : "soft", { alignSelf: "flex-start" })} disabled={join.isPending} onClick={() => join.mutate()}>{c.myStatus === "invited" ? "Accept invitation" : c.joinMode === "approval" ? "Ask to join" : "Join"}</button>}
    </div>
  );
}

// ── The feed ─────────────────────────────────────────────────────────────────────────────────────
export function usePostPages(key, fetchPage, enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: ["connect", "posts", ...key],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ? { cursor: last.nextCursor } : { page: (last.page || 1) + 1 }) : undefined),
  });
}

export function PostList({ query, me, communities, emptyText }) {
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorBox error={query.error} onRetry={query.refetch} />;
  const pages = query.data.pages;
  const pinned = pages[0]?.pinned || [];
  const items = pages.flatMap((p) => p.items);
  if (!pinned.length && !items.length) return <Empty icon="edit-3" title="No posts here yet">{emptyText}</Empty>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {[...pinned, ...items].map((p) => <PostCard key={p.id} post={p} me={me} base={base} communities={communities} />)}
      {query.hasNextPage && <button type="button" style={btn("ghost", { justifySelf: "center" })} onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? "Loading…" : "Show more"}</button>}
    </div>
  );
}

// Announcements from the Digifunzi team that reached this learner (26 Nov 2026), on top of the feed:
// the live ones, newest first — each opens on their Announcements page.
function AnnouncementStrip() {
  const { data } = useQuery({ queryKey: ["announcements", "mine"], queryFn: announcementsApi.mine });
  const live = (data?.announcements || []).filter((a) => a.state === "live").slice(0, 3);
  if (!live.length) return null;
  return (
    <section style={{ ...card, padding: 14, display: "grid", gap: 8, borderColor: C.navyBorder, background: C.navyTint }}>
      <SectionTitle right={<Link to="/learner-portal/announcements" style={btn("link")}>All</Link>}><FiVolume2 /> From the Digifunzi team</SectionTitle>
      {live.map((a) => (
        <Link key={a.id} to={`/learner-portal/announcements/${a.id}`} style={{ display: "grid", gap: 3, padding: "9px 11px", borderRadius: 12, background: "#fff", border: `1px solid ${C.line}`, textDecoration: "none", color: C.ink }}>
          <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {!a.seen && <span style={pill("waiting")}>New</span>}
            <strong>{a.title}</strong>
          </span>
          {a.summary && <span style={{ fontSize: 13, color: C.inkSoft }}>{a.summary}</span>}
        </Link>
      ))}
    </section>
  );
}

export function FeedPage() {
  const { me } = useOutletContext();
  const wide = !useNarrow(1100);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("new");
  const [scope, setScope] = useState("feed");
  const mine = useMyCommunities();
  const query = usePostPages([scope, category, sort], (param) => connectApi.posts({ scope, category, sort, ...(param || {}) }));
  const writing = me.status === "active";
  return (
    // On a laptop the feed takes most of the screen with a side column beside it; narrower, one column.
    <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 1fr) 340px" : "100%", gap: 16, alignItems: "start" }}>
    <div style={{ display: "grid", gap: 14 }}>
      <AnnouncementStrip />
      {writing && <Composer me={me} communities={mine.data || []} />}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}><Chips options={(me.catalogue?.categories || [])} value={category} onChange={setCategory} /></div>
        <select aria-label="Show" value={`${scope}:${sort}`} onChange={(e) => { const [s, o] = e.target.value.split(":"); setScope(s); setSort(o); }} style={{ padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontFamily: FONT, fontWeight: 700 }}>
          <option value="feed:new">Newest</option>
          <option value="feed:top">Popular this month</option>
          <option value="mine:new">My posts</option>
        </select>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Your feed shows posts for everyone plus the communities you've joined.</p>
      <PostList query={query} me={me} communities={mine.data || []} emptyText="Be the first to share something!" />
    </div>
    {wide && <FeedSide me={me} communities={mine.data || []} />}
    </div>
  );
}

// Beside the feed on a laptop: my communities, open challenges and people with my interests.
function FeedSide({ me, communities }) {
  const challenges = useQuery({ queryKey: ["connect", "challenges", "current"], queryFn: () => connectApi.challenges("current") });
  const people = useQuery({ queryKey: ["connect", "people", "discover"], queryFn: () => connectApi.people({}) });
  const row = { display: "flex", gap: 10, alignItems: "center", padding: "8px 0", textDecoration: "none", color: C.ink, borderBottom: `1px solid ${C.line}` };
  return (
    <aside style={{ display: "grid", gap: 14, position: "sticky", top: 12 }}>
      <section style={card}>
        <SectionTitle right={<Link to={`${base}/communities?all=1`} style={btn("link")}>Find more</Link>}>My communities</SectionTitle>
        {communities.length ? communities.slice(0, 6).map((c) => (
          <Link key={c.id} to={`${base}/communities/${c.slug}`} style={row}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: c.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconFor name={c.icon} size={16} /></span>
            <span style={{ minWidth: 0 }}><strong style={{ display: "block" }}>{c.name}</strong><span style={{ fontSize: 12.5, color: C.muted }}>{c.memberCount} members</span></span>
          </Link>
        )) : <p style={{ margin: 0, color: C.muted }}>Join a community to see its posts in your feed.</p>}
      </section>
      <section style={card}>
        <SectionTitle right={<Link to={`${base}/challenges`} style={btn("link")}>All</Link>}>Open challenges</SectionTitle>
        {(challenges.data || []).slice(0, 3).map((c) => (
          <Link key={c.id} to={`${base}/challenges/${c.id}`} style={{ ...row, display: "block" }}>
            <strong>{c.title}</strong>
            <div style={{ fontSize: 12.5, color: C.muted }}>{c.endsOn ? `Until ${c.endsOn}` : "Open now"}{c.myEntry ? " · you're in" : ""}</div>
          </Link>
        ))}
        {challenges.data && !challenges.data.length && <p style={{ margin: 0, color: C.muted }}>No challenges right now.</p>}
      </section>
      <section style={card}>
        <SectionTitle right={<Link to={`${base}/people`} style={btn("link")}>More</Link>}>People like you</SectionTitle>
        {(people.data?.items || []).slice(0, 4).map((p) => (
          <Link key={p.id} to={`${base}/people/${p.id}`} style={row}>
            <MemberAvatar card={p} size={34} />
            <span style={{ minWidth: 0 }}><strong style={{ display: "block" }}>{p.displayName}</strong><span style={{ fontSize: 12.5, color: C.muted }}>{p.shared.length ? `Also into ${p.shared.map((k) => labelOf(me, k)).slice(0, 2).join(", ")}` : "On Connect"}</span></span>
          </Link>
        ))}
        {people.data && !people.data.items.length && <p style={{ margin: 0, color: C.muted }}>When more learners join, they'll show up here.</p>}
      </section>
    </aside>
  );
}

export function PostPage() {
  const { me } = useOutletContext();
  const { postId } = useParams();
  const navigate = useNavigate();
  const mine = useMyCommunities();
  const wide = !useNarrow(1100);
  const q = useQuery({ queryKey: ["connect", "post", postId], queryFn: () => connectApi.post(postId) });
  return (
    <div>
      <button type="button" style={{ ...btn("link"), marginBottom: 8 }} onClick={() => navigate(-1)}>← Back</button>
      {q.isLoading ? <Loading rows={1} /> : q.error ? <ErrorBox error={q.error} /> : (
        // On a laptop the post and its comments sit side by side.
        <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 1.3fr) minmax(0, 1fr)" : "100%", gap: 16, alignItems: "start" }}>
          <PostCard post={q.data} me={me} base={base} communities={mine.data || []} showCommentsLink={false} />
          <div style={{ marginTop: wide ? -12 : 0 }}><Comments post={q.data} me={me} base={base} /></div>
        </div>
      )}
    </div>
  );
}

