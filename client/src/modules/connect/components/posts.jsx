import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiThumbsUp, FiHeart, FiStar, FiZap, FiAward, FiMessageSquare, FiRepeat, FiLink, FiClock, FiMapPin, FiCornerDownRight, FiExternalLink, FiTool } from "react-icons/fi";
import { askConfirm, askText } from "../../../components/ui/AskDialog";
import { connectApi, mediaUrl } from "../services/connectApi";
import { C, FONT, card, btn, pill, input, label, MemberAvatar, Name, FileGallery, FilePickerButton, ReportDialog, MoreMenu, PlainText, Modal, timeAgo, errorOf } from "./kit";

export const REACTION_LOOK = {
  like: { Icon: FiThumbsUp, label: "Like" },
  love: { Icon: FiHeart, label: "Love it" },
  wow: { Icon: FiStar, label: "Wow" },
  idea: { Icon: FiZap, label: "Great idea" },
  clap: { Icon: FiAward, label: "Well done" },
};

const invalidatePosts = (qc) => {
  qc.invalidateQueries({ queryKey: ["connect", "posts"] });
  qc.invalidateQueries({ queryKey: ["connect", "post"] });
  qc.invalidateQueries({ queryKey: ["connect", "admin"] });
};

// ── Writing a post ───────────────────────────────────────────────────────────────────────────────
export function Composer({ me, communityId = null, communities = [], onPosted, placeholder }) {
  const qc = useQueryClient();
  const isLearner = me.kind === "learner";
  const cats = (me.catalogue?.categories || []).filter((c) => !c.staffOnly || !isLearner);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(isLearner ? "general" : "announcement");
  const [files, setFiles] = useState([]);
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [where, setWhere] = useState(communityId || "");
  const [attach, setAttach] = useState(null); // { projectId } | { achievement }
  const [picker, setPicker] = useState(null);
  const projects = useQuery({ queryKey: ["connect", "projects", "mine"], queryFn: () => connectApi.projects({ view: "mine" }), enabled: isLearner && picker === "project" });
  const achievements = useQuery({ queryKey: ["connect", "achievements"], queryFn: connectApi.achievements, enabled: isLearner && picker === "achievement" });

  const send = useMutation({
    mutationFn: () => connectApi.createPost({
      body, category, communityId: where || null, fileIds: files.map((f) => f.id), link: showLink && link ? link : undefined,
      projectId: attach?.projectId || undefined, achievement: attach?.achievement || undefined,
    }),
    onSuccess: (post) => {
      setBody(""); setFiles([]); setLink(""); setShowLink(false); setAttach(null);
      toast.success(post.status === "pending" ? "Sent! A teacher will check it before others see it." : "Posted!");
      invalidatePosts(qc);
      qc.invalidateQueries({ queryKey: ["connect", "me"] });
      onPosted?.(post);
    },
    onError: (err) => toast.error(errorOf(err, "Couldn't post that")),
  });
  const canSend = (body.trim() || files.length || attach) && !send.isPending;

  return (
    <div style={{ ...card, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {isLearner && <span className="cx-hide-narrow"><MemberAvatar card={me.profile} size={42} /></span>}
        <textarea aria-label="Write a post" rows={3} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder || (isLearner ? "Share something you made, ask a question, or post an idea…" : "Write an announcement…")}
          style={{ ...input, resize: "vertical", minHeight: 76 }} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {cats.map((c) => (
          <button key={c.key} type="button" onClick={() => setCategory(c.key)} style={{ ...pill(category === c.key ? "strong" : "neutral"), cursor: "pointer", padding: "5px 11px", fontSize: 12.5 }}>{c.label}</button>
        ))}
      </div>
      <FileGallery files={files} compact onRemove={(id) => setFiles((fs) => fs.filter((f) => f.id !== id))} />
      {attach?.label && (
        <div style={{ ...pill("info"), padding: "6px 10px", fontSize: 13 }}>
          {attach.projectId ? <FiTool /> : <FiAward />} {attach.label}
          <button type="button" onClick={() => setAttach(null)} style={{ ...btn("link"), padding: 0, marginLeft: 6 }} aria-label="Remove">×</button>
        </div>
      )}
      {showLink && <input aria-label="Link" placeholder="A link to Scratch, GitHub, YouTube…" value={link} onChange={(e) => setLink(e.target.value)} style={input} />}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <FilePickerButton current={files.length} onUploaded={(f) => setFiles((fs) => [...fs, f])} label="Picture or file" />
        <button type="button" style={btn("ghost")} onClick={() => setShowLink((s) => !s)}><FiLink /> Link</button>
        {isLearner && <button type="button" style={btn("ghost")} onClick={() => setPicker("project")}><FiTool /> Project</button>}
        {isLearner && <button type="button" style={btn("ghost")} onClick={() => setPicker("achievement")}><FiAward /> Achievement</button>}
        {!communityId && communities.length > 0 && (
          <select aria-label="Where to post" value={where} onChange={(e) => setWhere(e.target.value)} style={{ ...input, width: "auto", maxWidth: "100%", padding: "8px 10px" }}>
            <option value="">Everyone (main feed)</option>
            {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" style={btn("primary", { opacity: canSend ? 1 : 0.5 })} disabled={!canSend} onClick={() => send.mutate()}>{send.isPending ? "Posting…" : "Post"}</button>
      </div>
      {isLearner && <p style={{ margin: 0, fontSize: 12.5, color: C.muted }}>Keep it kind and keep it private — no phone numbers, emails or where you live.</p>}

      <Modal open={picker === "project"} title="Share a project" onClose={() => setPicker(null)}>
        {projects.isLoading ? "Loading…" : (projects.data?.items || []).filter((p) => p.visibility === "community" && p.myStatus === "active" && p.moderation === "visible").map((p) => (
          <button key={p.id} type="button" style={{ ...btn("ghost"), width: "100%", justifyContent: "flex-start", marginBottom: 6 }} onClick={() => { setAttach({ projectId: p.id, label: p.title }); setCategory("projects"); setPicker(null); }}>
            <FiTool /> {p.title}
          </button>
        ))}
        {projects.data && !(projects.data.items || []).some((p) => p.visibility === "community" && p.myStatus === "active") && <p style={{ color: C.muted }}>Projects you're on that the community can see show here.</p>}
      </Modal>
      <Modal open={picker === "achievement"} title="Share an achievement" onClose={() => setPicker(null)}>
        {achievements.isLoading ? "Loading…" : (achievements.data || []).map((a) => (
          <button key={`${a.kind}:${a.id}`} type="button" style={{ ...btn("ghost"), width: "100%", justifyContent: "flex-start", marginBottom: 6, whiteSpace: "normal", textAlign: "left" }}
            onClick={() => { setAttach({ achievement: { kind: a.kind, id: a.id }, label: a.label }); setCategory("achievements"); setPicker(null); }}>
            <FiAward /> <span><strong>{a.label}</strong>{a.detail ? <span style={{ color: C.muted }}> · {a.detail}</span> : null}</span>
          </button>
        ))}
        {achievements.data && !achievements.data.length && <p style={{ color: C.muted }}>Badges and certificates you earn show here — then you can share them.</p>}
      </Modal>
    </div>
  );
}

// ── One post ─────────────────────────────────────────────────────────────────────────────────────
export function PostCard({ post, me, base, communities = [], showCommentsLink = true }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reporting, setReporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [sharing, setSharing] = useState(false);
  const isLearner = me.kind === "learner";
  const personLink = base && post.author?.id && post.author.kind === "learner" ? () => navigate(`${base}/people/${post.author.id}`) : undefined;

  const react = useMutation({
    mutationFn: (kind) => connectApi.react(post.id, kind),
    onSuccess: () => invalidatePosts(qc),
    onError: (err) => toast.error(errorOf(err)),
  });
  const save = useMutation({
    mutationFn: () => connectApi.updatePost(post.id, { body: draft }),
    onSuccess: () => { setEditing(false); invalidatePosts(qc); },
    onError: (err) => toast.error(errorOf(err, "Couldn't save")),
  });
  const del = async () => {
    if (!(await askConfirm({ title: "Delete this post?", message: "It will be gone for good.", confirmLabel: "Delete", tone: "danger" }))) return;
    try { await connectApi.deletePost(post.id); toast.success("Deleted"); invalidatePosts(qc); if (!showCommentsLink) navigate(base ? `${base}/feed` : -1); } catch (err) { toast.error(errorOf(err)); }
  };
  const takeDown = async () => {
    const reason = await askText({ title: "Take this post down?", message: "The learner is told it was taken down. Say why (they'll see this).", label: "Reason", required: false, tone: "danger", confirmLabel: "Take down" });
    if (reason === null) return;
    try { await connectApi.removePost(post.id, reason); toast.success("Taken down"); invalidatePosts(qc); } catch (err) { toast.error(errorOf(err)); }
  };
  const pin = async (on) => { try { await connectApi.pin(post.id, on); invalidatePosts(qc); } catch (err) { toast.error(errorOf(err)); } };

  const category = me.catalogue?.categories?.find((c) => c.key === post.category);
  return (
    <article style={{ ...card, padding: 16, borderColor: post.pinned ? C.goldBorder : post.status !== "visible" ? C.goldBorder : C.border, background: post.status === "removed" ? C.greyTint : "#fff" }}>
      <header style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <MemberAvatar card={post.author} size={42} />
        <div style={{ flex: "1 1 140px", minWidth: 0 }}>
          <Name card={post.author} onClick={personLink} />
          <div style={{ fontSize: 12.5, color: C.muted, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span>{timeAgo(post.createdAt)}{post.editedAt ? " · edited" : ""}</span>
            {post.community && base && <Link to={`${base}/communities/${post.community.slug}`} style={{ color: C.mid, fontWeight: 800, textDecoration: "none" }}>in {post.community.name}</Link>}
            {post.community && !base && <span>in {post.community.name}</span>}
          </div>
        </div>
        {post.pinned && <span style={pill("waiting")}><FiMapPin size={11} /> Pinned</span>}
        {category && <span style={pill(post.category === "announcement" ? "strong" : "info")}>{category.label}</span>}
        <MoreMenu items={[
          post.canEdit && { label: "Edit", onClick: () => { setDraft(post.body); setEditing(true); } },
          post.canDelete && { label: "Delete", onClick: del, danger: true },
          !post.mine && isLearner && { label: "Report", onClick: () => setReporting(true) },
          post.canModerate && post.status === "visible" && { label: post.pinned ? "Unpin" : "Pin to the top", onClick: () => pin(!post.pinned) },
          post.canModerate && post.status !== "removed" && !post.mine && { label: "Take down", onClick: takeDown, danger: true },
        ]} />
      </header>

      {post.status === "pending" && <div style={{ ...pill("waiting"), margin: "10px 0 0", whiteSpace: "normal" }}><FiClock /> {post.reviewReason || "Waiting for a teacher to check it."}</div>}
      {post.status === "removed" && <div style={{ ...pill("danger"), margin: "10px 0 0", whiteSpace: "normal" }}>Taken down by a moderator{post.removedReason ? `: ${post.removedReason}` : ""}</div>}

      {editing ? (
        <div style={{ marginTop: 10 }}>
          <textarea rows={4} value={draft} maxLength={3000} onChange={(e) => setDraft(e.target.value)} style={input} aria-label="Edit post" />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" style={btn("primary")} onClick={() => save.mutate()} disabled={save.isPending}>Save</button>
            <button type="button" style={btn("ghost")} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : post.body ? <PlainText style={{ marginTop: 10, fontSize: 15 }}>{post.body}</PlainText> : null}

      {post.achievement && (
        <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 14, background: C.goldTint, border: `1px solid ${C.goldBorder}`, display: "flex", gap: 10, alignItems: "center" }}>
          <FiAward size={24} color={C.goldText} />
          <div><div style={{ fontWeight: 900, color: C.goldText }}>{post.achievement.label}</div>{post.achievement.detail && <div style={{ fontSize: 13, color: C.goldText }}>{post.achievement.detail}</div>}</div>
        </div>
      )}
      {post.project && <ProjectChip project={post.project} base={base} />}
      <FileGallery files={post.files} />
      {post.link && <a href={post.link} target="_blank" rel="noreferrer noopener" style={{ ...btn("soft"), marginTop: 8, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}><FiExternalLink /> {post.link.replace(/^https:\/\//, "").slice(0, 60)}</a>}
      {post.sharedPost && (
        <div style={{ marginTop: 10, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: 12, background: C.canvas }}>
          {post.sharedPost.unavailable ? <span style={{ color: C.muted }}>This post isn't available any more.</span> : (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><MemberAvatar card={post.sharedPost.author} size={28} /><Name card={post.sharedPost.author} /><span style={{ fontSize: 12, color: C.muted }}>{timeAgo(post.sharedPost.createdAt)}</span></div>
              {post.sharedPost.body && <PlainText style={{ marginTop: 6, fontSize: 14 }}>{post.sharedPost.body}</PlainText>}
              <FileGallery files={post.sharedPost.files} compact />
              {post.sharedPost.project && <ProjectChip project={post.sharedPost.project} base={base} />}
            </>
          )}
        </div>
      )}

      {post.status === "visible" && (
        <footer style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}`, flexWrap: "wrap" }}>
          {Object.entries(REACTION_LOOK).map(([kind, { Icon, label: text }]) => {
            const mine = post.myReaction === kind;
            return (
              <button key={kind} type="button" title={text} aria-label={text} aria-pressed={mine} onClick={() => react.mutate(mine ? null : kind)}
                style={{ ...btn(mine ? "soft" : "link"), padding: "0 8px", minWidth: 40, minHeight: 40, color: mine ? C.navy : C.muted }}>
                <Icon size={17} />
              </button>
            );
          })}
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 700, marginRight: "auto" }}>{post.reactionCount > 0 ? `${post.reactionCount} reaction${post.reactionCount === 1 ? "" : "s"}` : ""}</span>
          {showCommentsLink && base ? (
            <Link to={`${base}/posts/${post.id}`} style={{ ...btn("link"), textDecoration: "none" }}><FiMessageSquare /> {post.commentCount || ""} Comment{post.commentCount === 1 ? "" : "s"}</Link>
          ) : <span style={{ ...btn("link"), cursor: "default" }}><FiMessageSquare /> {post.commentCount}</span>}
          {isLearner && <button type="button" style={btn("link")} onClick={() => setSharing(true)}><FiRepeat /> Share</button>}
        </footer>
      )}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="post" targetId={post.id} reasons={me.catalogue?.reportReasons || []} what="this post" />
      <ShareDialog open={sharing} onClose={() => setSharing(false)} post={post} communities={communities} />
    </article>
  );
}

function ProjectChip({ project, base }) {
  const inner = (
    <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", padding: 10, borderRadius: 14, border: `1.5px solid ${C.skyBorder}`, background: C.skyTint }}>
      {project.cover ? <img src={mediaUrl(project.cover.url)} alt="" style={{ width: 54, height: 54, borderRadius: 10, objectFit: "cover" }} /> : <span style={{ width: 54, height: 54, borderRadius: 10, background: C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><FiTool size={22} /></span>}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 900, color: C.navy }}>{project.title}</div>
        <div style={{ fontSize: 12.5, color: C.muted }}>Project · {project.status === "done" ? "Finished" : project.status}</div>
      </div>
    </div>
  );
  return base ? <Link to={`${base}/projects/${project.id}`} style={{ textDecoration: "none" }}>{inner}</Link> : inner;
}

function ShareDialog({ open, onClose, post, communities }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [where, setWhere] = useState("");
  const share = useMutation({
    mutationFn: () => connectApi.share(post.id, { body: text, communityId: where || null }),
    onSuccess: (p) => { toast.success(p.status === "pending" ? "Shared — a teacher will check it first." : "Shared!"); setText(""); onClose(); invalidatePosts(qc); },
    onError: (err) => toast.error(errorOf(err, "Couldn't share")),
  });
  return (
    <Modal open={open} title="Share this post" onClose={onClose}
      footer={<><button type="button" style={btn("ghost")} onClick={onClose}>Cancel</button><button type="button" style={btn("primary")} disabled={share.isPending} onClick={() => share.mutate()}>Share</button></>}>
      <label style={label} htmlFor="share-text">Say something (optional)</label>
      <textarea id="share-text" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} style={input} />
      {communities.length > 0 && (
        <>
          <label style={label} htmlFor="share-where">Where</label>
          <select id="share-where" value={where} onChange={(e) => setWhere(e.target.value)} style={input}>
            <option value="">Everyone (main feed)</option>
            {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </>
      )}
    </Modal>
  );
}

// ── Comments ─────────────────────────────────────────────────────────────────────────────────────
export function Comments({ post, me, base }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [reporting, setReporting] = useState(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["connect", "post", post.id] });
  const add = useMutation({
    mutationFn: ({ body, parentCommentId }) => connectApi.comment(post.id, { body, parentCommentId }),
    onSuccess: () => { setText(""); setReplyTo(null); refresh(); },
    onError: (err) => toast.error(errorOf(err, "Couldn't add that")),
  });
  const canWrite = post.status === "visible" && (me.kind === "learner" ? me.status === "active" : post.canModerate);
  const remove = async (c) => {
    const mine = c.mine;
    let reason = null;
    if (!mine) {
      reason = await askText({ title: "Take this comment down?", message: "The learner is told it was taken down.", label: "Reason (optional)", required: false, tone: "danger", confirmLabel: "Take down" });
      if (reason === null) return;
    } else if (!(await askConfirm({ title: "Delete your comment?", confirmLabel: "Delete", tone: "danger" }))) return;
    try { await connectApi.deleteComment(c.id, reason || undefined); refresh(); } catch (err) { toast.error(errorOf(err)); }
  };
  const edit = async (c) => {
    const body = await askText({ title: "Edit your comment", label: "Comment", required: true, placeholder: c.body });
    if (!body) return;
    try { await connectApi.editComment(c.id, body); refresh(); } catch (err) { toast.error(errorOf(err)); }
  };
  const row = (c, reply = false) => (
    <div key={c.id} style={{ display: "flex", gap: 10, marginLeft: reply ? 44 : 0, marginTop: 10 }}>
      {reply && <FiCornerDownRight color={C.faint} style={{ marginTop: 10 }} />}
      <MemberAvatar card={c.author} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ background: c.removed ? C.greyTint : C.canvas, borderRadius: 14, padding: "8px 12px" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Name card={c.author} onClick={base && c.author?.id ? () => navigate(`${base}/people/${c.author.id}`) : undefined} />
            <span style={{ fontSize: 12, color: C.muted }}>{timeAgo(c.createdAt)}{c.editedAt ? " · edited" : ""}</span>
            <span style={{ flex: 1 }} />
            <MoreMenu items={[
              c.mine && !c.removed && { label: "Edit", onClick: () => edit(c) },
              (c.mine || c.canModerate) && !c.removed && { label: c.mine ? "Delete" : "Take down", onClick: () => remove(c), danger: true },
              !c.mine && me.kind === "learner" && !c.removed && { label: "Report", onClick: () => setReporting(c.id) },
            ]} />
          </div>
          {c.removed ? <em style={{ color: C.muted, fontSize: 13.5 }}>{c.body ? `Taken down: ${c.body}` : "This comment was taken down."}</em> : <PlainText style={{ fontSize: 14.5 }}>{c.body}</PlainText>}
        </div>
        {!reply && canWrite && !c.removed && <button type="button" style={{ ...btn("link"), fontSize: 13 }} onClick={() => setReplyTo(c)}>Reply</button>}
      </div>
    </div>
  );
  return (
    <section style={{ ...card, marginTop: 12 }} aria-label="Comments">
      <h3 style={{ margin: 0, fontSize: 16, fontFamily: FONT }}>Comments</h3>
      {post.comments.length === 0 && <p style={{ color: C.muted, margin: "8px 0 0" }}>No comments yet{canWrite ? " — be the first!" : "."}</p>}
      {post.comments.map((c) => (
        <div key={c.id}>{row(c)}{c.replies.map((r) => row(r, true))}</div>
      ))}
      {canWrite && (
        <div style={{ marginTop: 14 }}>
          {replyTo && <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Replying to {replyTo.author?.displayName} <button type="button" style={btn("link")} onClick={() => setReplyTo(null)}>Cancel</button></div>}
          <div style={{ display: "flex", gap: 8 }}>
            <textarea aria-label="Write a comment" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write something kind and helpful…" style={{ ...input, flex: 1 }} />
            <button type="button" style={btn("primary", { alignSelf: "flex-end" })} disabled={!text.trim() || add.isPending} onClick={() => add.mutate({ body: text.trim(), parentCommentId: replyTo?.id })}>Send</button>
          </div>
        </div>
      )}
      <ReportDialog open={!!reporting} onClose={() => setReporting(null)} targetType="comment" targetId={reporting} reasons={me.catalogue?.reportReasons || []} what="this comment" />
    </section>
  );
}

