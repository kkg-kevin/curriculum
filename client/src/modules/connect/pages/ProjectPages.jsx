import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiPlus, FiTool, FiUsers, FiCheckSquare, FiSquare, FiMessageCircle, FiStar, FiExternalLink, FiTrash2, FiUserPlus, FiFlag, FiEdit2 } from "react-icons/fi";
import { askConfirm, askText } from "../../../components/ui/AskDialog";
import { connectApi, mediaUrl } from "../services/connectApi";
import { C, card, btn, pill, input, label, Chip, Empty, ErrorBox, Loading, MemberAvatar, FileGallery, FilePickerButton, ReportDialog, MoreMenu, PlainText, Modal, timeAgo, errorOf, useNarrow } from "../components/kit";
import { CONNECT_BASE } from "./ConnectLayout";

const base = `${CONNECT_BASE}/projects`;
const STATUS = { idea: "Idea", building: "Building", testing: "Testing", done: "Finished" };
const STATUS_TONE = { idea: "neutral", building: "info", testing: "waiting", done: "good" };
const VIEWS = [
  { key: "mine", label: "My projects" },
  { key: "invites", label: "Invitations" },
  { key: "open", label: "Looking for members" },
  { key: "showcase", label: "Showcase" },
  { key: "all", label: "All projects" },
];

export function ProjectsPage() {
  const { me } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") || "mine";
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ["connect", "projects", view, q], queryFn: () => connectApi.projects({ view, q }) });
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {VIEWS.map((v) => <Chip key={v.key} active={view === v.key} onClick={() => setParams({ view: v.key })}>{v.label}{v.key === "invites" && me.counts?.projectInvites ? ` (${me.counts.projectInvites})` : ""}</Chip>)}
        <span style={{ flex: 1 }} />
        {me.status === "active" && <button type="button" style={btn("gold")} onClick={() => setCreating(true)}><FiPlus /> Start a project</button>}
      </div>
      {["open", "showcase", "all"].includes(view) && <input aria-label="Search projects" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} style={input} />}
      {list.isLoading ? <Loading rows={2} /> : list.error ? <ErrorBox error={list.error} /> : list.data.items.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
          {list.data.items.map((p) => <ProjectCard key={p.id} p={p} me={me} />)}
        </div>
      ) : (
        <Empty icon="tool" title={view === "mine" ? "No projects yet" : view === "invites" ? "No invitations" : "Nothing here yet"}
          action={view === "mine" && me.status === "active" && <button type="button" style={btn("primary")} onClick={() => setCreating(true)}><FiPlus /> Start a project</button>}>
          {view === "mine" ? "Start one and invite learners you met in any class or bootcamp — or join a team that's looking for members." : ""}
        </Empty>
      )}
      <ProjectForm open={creating} onClose={() => setCreating(false)} me={me} />
    </div>
  );
}

function ProjectCard({ p, me }) {
  const cat = me.catalogue?.projectCategories?.find((c) => c.key === p.category);
  return (
    <Link to={`${base}/${p.id}`} style={{ ...card, padding: 0, overflow: "hidden", textDecoration: "none", color: C.ink, display: "flex", flexDirection: "column" }}>
      {p.cover ? <img src={mediaUrl(p.cover.url)} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} /> : <div style={{ aspectRatio: "16 / 9", background: `linear-gradient(135deg, ${C.navy}, ${C.sky})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><FiTool size={34} /></div>}
      <div style={{ padding: 14, display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={pill(STATUS_TONE[p.status])}>{STATUS[p.status]}</span>
          {cat && <span style={pill("neutral")}>{cat.label}</span>}
          {p.showcased && <span style={pill("waiting")}><FiStar size={11} /> Showcase</span>}
          {p.myStatus === "invited" && <span style={pill("waiting")}>Invited</span>}
          {p.myStatus === "requested" && <span style={pill("neutral")}>Asked to join</span>}
          {p.lookingForMembers && p.status !== "done" && <span style={pill("info")}>Looking for members</span>}
        </div>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{p.title}</div>
        <div style={{ display: "flex", gap: -6 }}>{(p.team || []).slice(0, 6).map((m) => <span key={m.id} style={{ marginRight: -6 }}><MemberAvatar card={m} size={28} /></span>)}</div>
      </div>
    </Link>
  );
}

function ProjectForm({ open, onClose, me, project }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const blank = { title: "", description: "", category: "other", technologies: [], visibility: "community", lookingForMembers: false, demoLink: "", status: "idea" };
  const [f, setF] = useState(project ? { ...blank, ...project, demoLink: project.demoLink || "" } : blank);
  const [cover, setCover] = useState(project?.cover || null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  const save = useMutation({
    mutationFn: () => {
      const body = { title: f.title, description: f.description, category: f.category, technologies: f.technologies, visibility: f.visibility, lookingForMembers: f.lookingForMembers, demoLink: f.demoLink, status: f.status, coverFileId: cover?.id || null };
      return project ? connectApi.updateProject(project.id, body) : connectApi.createProject(body);
    },
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["connect", "projects"] }); qc.invalidateQueries({ queryKey: ["connect", "project", p.id] }); onClose(); if (!project) navigate(`${base}/${p.id}`); toast.success(project ? "Saved" : "Project started!"); },
    onError: (e) => toast.error(errorOf(e, "Couldn't save")),
  });
  const toggleTech = (k) => setF((x) => ({ ...x, technologies: x.technologies.includes(k) ? x.technologies.filter((t) => t !== k) : [...x.technologies, k].slice(0, 6) }));
  return (
    <Modal open={open} title={project ? "Edit project" : "Start a project"} onClose={onClose} width={640}
      footer={<><button type="button" style={btn("ghost")} onClick={onClose}>Cancel</button><button type="button" style={btn("primary")} disabled={f.title.trim().length < 3 || save.isPending} onClick={() => save.mutate()}>{project ? "Save" : "Start project"}</button></>}>
      <label style={label} htmlFor="pf-title">Title</label>
      <input id="pf-title" maxLength={120} value={f.title} onChange={set("title")} style={input} placeholder="e.g. Autonomous line-following robot" />
      <label style={label} htmlFor="pf-desc">What's it about?</label>
      <textarea id="pf-desc" rows={4} maxLength={4000} value={f.description} onChange={set("description")} style={input} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={label} htmlFor="pf-cat">Kind of project</label>
          <select id="pf-cat" value={f.category} onChange={set("category")} style={input}>{me.catalogue.projectCategories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
        <div><label style={label} htmlFor="pf-status">Where it's at</label>
          <select id="pf-status" value={f.status} onChange={set("status")} style={input}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      </div>
      <span style={label}>Uses</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{me.catalogue.interests.map((i) => <Chip key={i.key} active={f.technologies.includes(i.key)} onClick={() => toggleTech(i.key)}>{i.label}</Chip>)}</div>
      <span style={label}>Cover picture</span>
      {cover ? <FileGallery files={[cover]} compact onRemove={() => setCover(null)} /> : <FilePickerButton imagesOnly max={1} onUploaded={setCover} label="Add a cover picture" />}
      <label style={label} htmlFor="pf-demo">Demo link (Scratch, GitHub, YouTube…)</label>
      <input id="pf-demo" value={f.demoLink} onChange={set("demoLink")} style={input} placeholder="https://scratch.mit.edu/projects/…" />
      <label style={label} htmlFor="pf-vis">Who can see it</label>
      <select id="pf-vis" value={f.visibility} onChange={set("visibility")} style={input}>
        <option value="community">Everyone on Connect</option>
        <option value="team">Only our team</option>
      </select>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontWeight: 700 }}>
        <input type="checkbox" checked={f.lookingForMembers} onChange={set("lookingForMembers")} disabled={f.visibility !== "community"} /> We're looking for team members
      </label>
    </Modal>
  );
}

const TABS = ["overview", "team", "updates", "milestones", "files"];

export function ProjectPage() {
  const { me } = useOutletContext();
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "overview";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const narrow = useNarrow(900);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const q = useQuery({ queryKey: ["connect", "project", projectId], queryFn: () => connectApi.project(projectId) });
  const set = (data) => { qc.setQueryData(["connect", "project", projectId], data); qc.invalidateQueries({ queryKey: ["connect", "projects"] }); qc.invalidateQueries({ queryKey: ["connect", "counts"] }); };
  const run = async (fn, ok) => { try { const r = await fn(); set(r?.project?.id ? r.project : r); if (ok) toast.success(ok); return r; } catch (e) { toast.error(errorOf(e)); return null; } };

  if (q.isLoading) return <Loading rows={2} />;
  if (q.error) return <ErrorBox error={q.error} />;
  const p = q.data;
  const active = me.status === "active";
  const canWork = p.onTeam && active && p.moderation === "visible";

  const showOff = async () => {
    const text = await askText({ title: "Show it off!", message: "Your project joins the showcase and a post goes on the feed.", label: "What do you want to say?", required: false, placeholder: `We finished "${p.title}"!` });
    if (text === null) return;
    const r = await run(() => connectApi.showcase(p.id, text || undefined));
    if (r) toast.success(r.post?.status === "pending" ? "In the showcase! A teacher will check the post first." : "In the showcase!");
  };
  const del = async () => {
    if (!(await askConfirm({ title: "Delete this project?", message: "It disappears for everyone and its chat closes.", confirmLabel: "Delete", tone: "danger" }))) return;
    try { await connectApi.deleteProject(p.id); qc.invalidateQueries({ queryKey: ["connect", "projects"] }); navigate(base); } catch (e) { toast.error(errorOf(e)); }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {p.cover && <img src={mediaUrl(p.cover.url)} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />}
        <div style={{ padding: 18, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={pill(STATUS_TONE[p.status])}>{STATUS[p.status]}</span>
              <span style={pill("neutral")}>{me.catalogue.projectCategories.find((c) => c.key === p.category)?.label}</span>
              {p.visibility === "team" && <span style={pill("strong")}>Team only</span>}
              {p.showcased && <span style={pill("waiting")}><FiStar size={11} /> Showcase</span>}
              {p.moderation === "removed" && <span style={pill("danger")}>Taken down by a moderator</span>}
            </div>
            <h1 style={{ margin: 0, fontSize: 26 }}>{p.title}</h1>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>{p.team.filter((t) => t.status === "active").map((t) => <MemberAvatar key={t.member.id} card={t.member} size={32} />)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.myStatus === "invited" && active && <>
              <button type="button" style={btn("gold")} onClick={() => run(() => connectApi.answerInvite(p.id, true), "Welcome to the team!")}>Join the team</button>
              <button type="button" style={btn("ghost")} onClick={() => run(() => connectApi.answerInvite(p.id, false))}>No thanks</button>
            </>}
            {!p.myStatus && p.lookingForMembers && p.status !== "done" && active && <button type="button" style={btn("gold")} onClick={() => run(() => connectApi.requestJoin(p.id), "Asked to join — the owner will answer.")}><FiUserPlus /> Ask to join</button>}
            {p.myStatus === "requested" && <span style={pill("waiting")}>Asked to join</span>}
            {p.conversationId && <Link to={`${CONNECT_BASE}/messages/${p.conversationId}`} style={{ ...btn("primary"), textDecoration: "none" }}><FiMessageCircle /> Team chat</Link>}
            {canWork && p.status === "done" && !p.showcased && p.visibility === "community" && <button type="button" style={btn("gold")} onClick={showOff}><FiStar /> Show it off</button>}
            {p.demoLink && <a href={p.demoLink} target="_blank" rel="noreferrer noopener" style={{ ...btn("soft"), textDecoration: "none" }}><FiExternalLink /> Demo</a>}
            <MoreMenu items={[
              canWork && { label: "Edit project", onClick: () => setEditing(true) },
              canWork && { label: "Invite people", onClick: () => setInviting(true) },
              p.isOwner && { label: "Delete project", onClick: del, danger: true },
              !p.onTeam && me.kind === "learner" && { label: "Report", onClick: () => setReporting(true) },
            ]} />
          </div>
        </div>
      </div>

      <nav style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {TABS.map((t) => <Chip key={t} active={tab === t} onClick={() => setParams({ tab: t })}>{t[0].toUpperCase() + t.slice(1)}</Chip>)}
      </nav>

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 14 }}>
          <section style={card}>
            <h3 style={{ marginTop: 0 }}>About the project</h3>
            <PlainText style={{ color: C.inkSoft }}>{p.description || "No description yet."}</PlainText>
            {p.technologies.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>{p.technologies.map((t) => <span key={t} style={pill("info")}>{me.catalogue.interests.find((i) => i.key === t)?.label || t}</span>)}</div>}
          </section>
          <section style={card}>
            <h3 style={{ marginTop: 0 }}>Progress</h3>
            <Progress milestones={p.milestones} />
            {p.challenges.length > 0 && <>
              <h4 style={{ marginBottom: 6 }}><FiFlag /> Challenges</h4>
              {p.challenges.map((c) => <Link key={c.id} to={`${CONNECT_BASE}/challenges/${c.id}`} style={{ display: "block", color: C.mid, fontWeight: 700 }}>{c.title} {c.award ? `· ${c.award.replace("_", " ")}` : `· ${c.status}`}</Link>)}
            </>}
          </section>
        </div>
      )}
      {tab === "team" && <TeamTab p={p} me={me} run={run} onInvite={() => setInviting(true)} canWork={canWork} />}
      {tab === "updates" && <UpdatesTab p={p} me={me} run={run} canWork={canWork} />}
      {tab === "milestones" && <MilestonesTab p={p} run={run} canWork={canWork} />}
      {tab === "files" && (p.files.length ? <div style={card}><FileGallery files={p.files} /></div> : <Empty icon="box" title="No files yet">Files and pictures added to updates collect here.</Empty>)}

      {editing && <ProjectForm open onClose={() => setEditing(false)} me={me} project={p} />}
      <InviteDialog open={inviting} onClose={() => setInviting(false)} p={p} run={run} />
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="project" targetId={p.id} reasons={me.catalogue?.reportReasons || []} what="this project" />
    </div>
  );
}

function Progress({ milestones }) {
  const done = milestones.filter((m) => m.done).length;
  const pct = milestones.length ? Math.round((done / milestones.length) * 100) : 0;
  return (
    <div>
      <div style={{ height: 10, borderRadius: 99, background: C.track, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: C.gold }} /></div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{milestones.length ? `${done} of ${milestones.length} milestones done` : "Add milestones to track your progress."}</div>
    </div>
  );
}

function TeamTab({ p, me, run, onInvite, canWork }) {
  const editRole = async (t) => {
    const responsibility = await askText({ title: `${t.member.displayName}'s job`, label: "What they look after", required: false, placeholder: t.responsibility || "e.g. Wiring and sensors" });
    if (responsibility === null) return;
    run(() => connectApi.editTeamMember(p.id, t.member.id, { responsibility }));
  };
  const remove = async (t) => {
    const self = t.isMe;
    if (!(await askConfirm({ title: self ? "Leave the team?" : `Take ${t.member.displayName} off the team?`, confirmLabel: self ? "Leave" : "Take off", tone: "danger" }))) return;
    run(() => connectApi.teamAction(p.id, t.member.id, "remove"));
  };
  return (
    <section style={card}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <h3 style={{ margin: 0, flex: 1 }}><FiUsers /> Team ({p.team.filter((t) => t.status === "active").length}/{p.teamMax})</h3>
        {canWork && <button type="button" style={btn("soft")} onClick={onInvite}><FiUserPlus /> Invite</button>}
      </div>
      {p.team.map((t) => (
        <div key={t.member.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
          <MemberAvatar card={t.member} size={38} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <Link to={`${CONNECT_BASE}/people/${t.member.id}`} style={{ fontWeight: 800, color: C.ink }}>{t.member.displayName}</Link>
            {t.role === "owner" && <span style={{ ...pill("strong"), marginLeft: 6 }}>Owner</span>}
            {t.status !== "active" && <span style={{ ...pill("waiting"), marginLeft: 6 }}>{t.status === "invited" ? "Invited" : "Asked to join"}</span>}
            <div style={{ fontSize: 13, color: C.muted }}>{t.responsibility || (t.status === "active" ? "No job set yet" : "")}</div>
          </div>
          {p.isOwner && t.status === "requested" && me.status === "active" && <>
            <button type="button" style={btn("primary")} onClick={() => run(() => connectApi.teamAction(p.id, t.member.id, "accept"), "Added to the team")}>Accept</button>
            <button type="button" style={btn("ghost")} onClick={() => run(() => connectApi.teamAction(p.id, t.member.id, "decline"))}>Decline</button>
          </>}
          {t.status === "active" && canWork && (p.isOwner || t.isMe) && (
            <MoreMenu items={[
              { label: "Set their job", onClick: () => editRole(t) },
              p.isOwner && !t.isMe && { label: "Make owner", onClick: () => run(() => connectApi.editTeamMember(p.id, t.member.id, { makeOwner: true })) },
              (p.isOwner || t.isMe) && { label: t.isMe ? "Leave the team" : "Take off the team", onClick: () => remove(t), danger: true },
            ]} />
          )}
        </div>
      ))}
    </section>
  );
}

function UpdatesTab({ p, me, run, canWork }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [link, setLink] = useState("");
  const [reporting, setReporting] = useState(null);
  const post = async () => {
    const r = await run(() => connectApi.addUpdate(p.id, { body, fileIds: files.map((f) => f.id), link: link || undefined }), "Update posted");
    if (r) { setBody(""); setFiles([]); setLink(""); }
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {canWork && (
        <div style={{ ...card, display: "grid", gap: 8 }}>
          <textarea aria-label="Project update" rows={3} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did the team do? What's next?" style={input} />
          <FileGallery files={files} compact onRemove={(id) => setFiles((fs) => fs.filter((f) => f.id !== id))} />
          <input aria-label="Link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link to a demo (optional)" style={input} />
          <div style={{ display: "flex", gap: 8 }}>
            <FilePickerButton current={files.length} onUploaded={(f) => setFiles((fs) => [...fs, f])} />
            <span style={{ flex: 1 }} />
            <button type="button" style={btn("primary")} disabled={body.trim().length < 2} onClick={post}>Post update</button>
          </div>
        </div>
      )}
      {p.updates.map((u) => (
        <article key={u.id} style={card}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <MemberAvatar card={u.author} size={34} />
            <strong style={{ flex: 1 }}>{u.author?.displayName}</strong>
            <span style={{ fontSize: 12.5, color: C.muted }}>{timeAgo(u.createdAt)}</span>
            <MoreMenu items={[
              (u.mine || p.canModerate) && { label: "Remove", onClick: () => run(() => connectApi.deleteUpdate(p.id, u.id)), danger: true },
              !u.mine && me.kind === "learner" && { label: "Report", onClick: () => setReporting(u.id) },
            ]} />
          </div>
          <PlainText style={{ marginTop: 8 }}>{u.body}</PlainText>
          <FileGallery files={u.files} />
          {u.link && <a href={u.link} target="_blank" rel="noreferrer noopener" style={{ ...btn("soft"), marginTop: 8, textDecoration: "none" }}><FiExternalLink /> Link</a>}
        </article>
      ))}
      {!p.updates.length && <Empty icon="edit-3" title="No updates yet">{canWork ? "Post what the team has done so far." : "The team hasn't posted any updates."}</Empty>}
      <ReportDialog open={!!reporting} onClose={() => setReporting(null)} targetType="update" targetId={reporting} reasons={me.catalogue?.reportReasons || []} what="this update" />
    </div>
  );
}

function MilestonesTab({ p, run, canWork }) {
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const add = async () => { const r = await run(() => connectApi.addMilestone(p.id, { title, dueOn: dueOn || null })); if (r) { setTitle(""); setDueOn(""); } };
  return (
    <section style={card}>
      <Progress milestones={p.milestones} />
      <div style={{ marginTop: 12 }}>
        {p.milestones.map((m) => (
          <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
            <button type="button" aria-label={m.done ? "Mark not done" : "Mark done"} disabled={!canWork} onClick={() => run(() => connectApi.editMilestone(p.id, m.id, { done: !m.done }))} style={{ ...btn("link"), color: m.done ? C.mid : C.faint }}>{m.done ? <FiCheckSquare size={20} /> : <FiSquare size={20} />}</button>
            <span style={{ flex: 1, textDecoration: m.done ? "line-through" : "none", fontWeight: 700 }}>{m.title}</span>
            {m.dueOn && <span style={pill("neutral")}>{m.dueOn}</span>}
            {canWork && <button type="button" aria-label="Rename" style={btn("link")} onClick={async () => { const t = await askText({ title: "Rename milestone", label: "Milestone", required: true, placeholder: m.title }); if (t) run(() => connectApi.editMilestone(p.id, m.id, { title: t })); }}><FiEdit2 /></button>}
            {canWork && <button type="button" aria-label="Delete" style={btn("link")} onClick={() => run(() => connectApi.deleteMilestone(p.id, m.id))}><FiTrash2 /></button>}
          </div>
        ))}
      </div>
      {canWork && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input aria-label="New milestone" placeholder="New milestone" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} style={{ ...input, flex: 2, minWidth: 180 }} />
          <input aria-label="Due date" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} style={{ ...input, flex: 1, minWidth: 140 }} />
          <button type="button" style={btn("primary")} disabled={title.trim().length < 2} onClick={add}><FiPlus /> Add</button>
        </div>
      )}
    </section>
  );
}

function InviteDialog({ open, onClose, p, run }) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState([]);
  const people = useQuery({ queryKey: ["connect", "people", "invite", q], queryFn: () => connectApi.people({ q }), enabled: open });
  const onTeam = new Set(p.team.map((t) => t.member.id));
  const send = async () => {
    const r = await run(() => connectApi.inviteToProject(p.id, chosen));
    if (r) {
      const failed = (r.results || []).filter((x) => !x.ok);
      toast.success(`Invited ${chosen.length - failed.length}`);
      failed.forEach((x) => toast(`${x.name || "Someone"}: ${x.reason}`));
      setChosen([]); onClose();
    }
  };
  return (
    <Modal open={open} title="Invite people to your team" onClose={onClose}
      footer={<><button type="button" style={btn("ghost")} onClick={onClose}>Cancel</button><button type="button" style={btn("primary")} disabled={!chosen.length} onClick={send}>Send invitations</button></>}>
      <p style={{ marginTop: 0, color: C.muted }}>Anyone on Connect can join your team — whichever class or bootcamp they're in.</p>
      <input aria-label="Search people" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} style={input} />
      <div style={{ marginTop: 10, maxHeight: 340, overflowY: "auto" }}>
        {(people.data?.items || []).filter((m) => !onTeam.has(m.id)).map((m) => (
          <label key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 4px", cursor: "pointer" }}>
            <input type="checkbox" checked={chosen.includes(m.id)} onChange={() => setChosen((c) => (c.includes(m.id) ? c.filter((x) => x !== m.id) : [...c, m.id]))} />
            <MemberAvatar card={m} size={30} /> <strong>{m.displayName}</strong>
            {m.shared?.length > 0 && <span style={{ fontSize: 12, color: C.muted }}>· likes the same things</span>}
          </label>
        ))}
      </div>
    </Modal>
  );
}
