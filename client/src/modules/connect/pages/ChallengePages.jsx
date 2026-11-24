import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiFlag, FiAward, FiUsers, FiUser, FiCalendar, FiExternalLink } from "react-icons/fi";
import { askConfirm } from "../../../components/ui/AskDialog";
import { connectApi } from "../services/connectApi";
import { C, card, btn, pill, input, label, Chip, Empty, ErrorBox, Loading, MemberAvatar, FileGallery, FilePickerButton, PlainText, Modal, errorOf, useNarrow } from "../components/kit";
import { CONNECT_BASE } from "./ConnectLayout";

const base = `${CONNECT_BASE}/challenges`;
export const AWARD_LABEL = { winner: "Winner", runner_up: "Runner-up", commended: "Commended", participant: "Took part" };
const MODE_LABEL = { individual: "On your own", team: "Teams", both: "On your own or as a team" };

export function ChallengesPage() {
  const { me } = useOutletContext();
  const [view, setView] = useState("current");
  const list = useQuery({ queryKey: ["connect", "challenges", view], queryFn: () => connectApi.challenges(view) });
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Chip active={view === "current"} onClick={() => setView("current")}>Open now</Chip>
        <Chip active={view === "past"} onClick={() => setView("past")}>Finished</Chip>
      </div>
      {list.isLoading ? <Loading rows={2} /> : list.error ? <ErrorBox error={list.error} /> : list.data.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {list.data.map((c) => <ChallengeCard key={c.id} c={c} me={me} to={`${base}/${c.id}`} />)}
        </div>
      ) : <Empty icon="flag" title={view === "current" ? "No challenges right now" : "No finished challenges yet"}>Teachers post coding, robotics and AI challenges here. You'll get a notice when one opens.</Empty>}
    </div>
  );
}

export function ChallengeCard({ c, me, to }) {
  const kind = me.catalogue?.challengeKinds?.find((k) => k.key === c.kind)?.label;
  return (
    <Link to={to} style={{ ...card, textDecoration: "none", color: C.ink, display: "grid", gap: 8, borderTop: `5px solid ${c.status === "open" ? C.gold : C.border}` }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {kind && <span style={pill("info")}>{kind}</span>}
        <span style={pill("neutral")}>{MODE_LABEL[c.entryMode]}</span>
        {c.status === "draft" && <span style={pill("waiting")}>Draft</span>}
        {c.status === "closed" && <span style={pill("neutral")}>Finished</span>}
        {c.myEntry && <span style={pill("good")}>{c.myEntry.award ? AWARD_LABEL[c.myEntry.award] : c.myEntry.status === "submitted" ? "Submitted" : "You're in"}</span>}
      </div>
      <div style={{ fontWeight: 900, fontSize: 17 }}><FiFlag style={{ verticalAlign: -2 }} /> {c.title}</div>
      <div style={{ fontSize: 13, color: C.muted }}>{c.startsOn || c.endsOn ? <><FiCalendar style={{ verticalAlign: -2 }} /> {c.startsOn ? `${c.startsOn} – ` : "Until "}{c.endsOn || "open"}</> : "Open now"} · {c.entries} taking part</div>
    </Link>
  );
}

export function ChallengePage() {
  const { me } = useOutletContext();
  const { challengeId } = useParams();
  const qc = useQueryClient();
  const narrow = useNarrow(900);
  const q = useQuery({ queryKey: ["connect", "challenge", challengeId], queryFn: () => connectApi.challenge(challengeId) });
  const [entering, setEntering] = useState(false);
  const set = (d) => { qc.setQueryData(["connect", "challenge", challengeId], d); qc.invalidateQueries({ queryKey: ["connect", "challenges"] }); };
  if (q.isLoading) return <Loading rows={2} />;
  if (q.error) return <ErrorBox error={q.error} />;
  const c = q.data;
  const active = me.status === "active";
  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0, 1.6fr) minmax(0, 1fr)", gap: narrow ? 12 : 16 }}>
      {/* On a phone: the challenge, then "Your entry" straight away, then rules and entries. */}
      {narrow && <div style={{ order: -2 }}><ChallengeHeader c={c} me={me} /></div>}
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        {!narrow && <ChallengeHeader c={c} me={me} />}
        {c.rules && <section style={card}><h3 style={{ marginTop: 0 }}>Rules</h3><PlainText>{c.rules}</PlainText></section>}
        <section>
          <h3 style={{ fontSize: 17 }}>Entries</h3>
          {c.entries.length ? c.entries.map((e) => <EntryCard key={e.id} e={e} />) : <Empty icon="flag" title="No entries shown yet">Entries appear here once they're submitted.</Empty>}
        </section>
      </div>
      <aside style={{ display: "grid", gap: 14, alignContent: "start", order: narrow ? -1 : 0 }}>
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Your entry</h3>
          {c.myEntry ? <MyEntry c={c} entry={c.myEntry} set={set} active={active} />
            : c.open && active ? <>
              <p style={{ color: C.muted, marginTop: 0 }}>{MODE_LABEL[c.entryMode]}{c.teamMin || c.teamMax ? ` · teams of ${c.teamMin || 2}–${c.teamMax || me.catalogue.teamMax}` : ""}.</p>
              <button type="button" style={btn("gold")} onClick={() => setEntering(true)}><FiFlag /> Take part</button>
            </> : <p style={{ color: C.muted, margin: 0 }}>{c.status === "closed" ? "This challenge has finished." : "Entries aren't open right now."}</p>}
        </section>
        {c.prizes && <section style={card}><h3 style={{ marginTop: 0 }}><FiAward /> Prizes</h3><PlainText>{c.prizes}</PlainText></section>}
        {c.competition && <section style={card}><h3 style={{ marginTop: 0 }}>Part of</h3><strong>{c.competition.name}</strong></section>}
      </aside>
      <EnterDialog open={entering} onClose={() => setEntering(false)} c={c} set={set} />
    </div>
  );
}

export function ChallengeHeader({ c, me }) {
  const kind = me.catalogue?.challengeKinds?.find((k) => k.key === c.kind)?.label;
  return (
    <section style={{ ...card, borderTop: `6px solid ${C.gold}` }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {kind && <span style={pill("info")}>{kind}</span>}
        <span style={pill("neutral")}>{MODE_LABEL[c.entryMode]}</span>
        <span style={pill(c.open ? "good" : "neutral")}>{c.status === "draft" ? "Draft" : c.open ? "Open" : c.status === "closed" ? "Finished" : "Not open yet"}</span>
      </div>
      <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>{c.title}</h1>
      <div style={{ color: C.muted, fontSize: 13.5, marginBottom: 10 }}>{c.startsOn ? `${c.startsOn} – ` : "Until "}{c.endsOn || "open"}{c.createdByName ? ` · set by ${c.createdByName}` : ""}</div>
      <PlainText>{c.description}</PlainText>
    </section>
  );
}

export function EntryCard({ e, children }) {
  return (
    <article style={{ ...card, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 16, flex: 1 }}>{e.title || "Untitled entry"}</strong>
        {e.award && <span style={pill(e.award === "participant" ? "neutral" : "waiting")}><FiAward size={11} /> {AWARD_LABEL[e.award]}</span>}
        {e.status !== "submitted" && <span style={pill("neutral")}>{e.status === "joined" ? "Not submitted yet" : e.status}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "6px 0", fontSize: 13, color: C.muted, flexWrap: "wrap" }}>
        {e.mode === "team" ? <FiUsers /> : <FiUser />}
        {e.people.map((p) => <span key={p.id} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><MemberAvatar card={p} size={22} /> {p.displayName}</span>)}
        {e.project && <span>· {e.project.title}</span>}
      </div>
      {e.description && <PlainText style={{ fontSize: 14 }}>{e.description}</PlainText>}
      <FileGallery files={e.files} compact />
      {e.link && <a href={e.link} target="_blank" rel="noreferrer noopener" style={{ ...btn("soft"), marginTop: 6, textDecoration: "none" }}><FiExternalLink /> See it</a>}
      {e.feedback && <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: C.goldTint, color: C.goldText, fontSize: 13.5 }}><strong>From the judges:</strong> {e.feedback}</div>}
      {children}
    </article>
  );
}

function MyEntry({ c, entry, set, active }) {
  const [title, setTitle] = useState(entry.title);
  const [description, setDescription] = useState(entry.description);
  const [link, setLink] = useState(entry.link || "");
  const [files, setFiles] = useState(entry.files);
  const save = useMutation({
    mutationFn: (submit) => connectApi.saveEntry(c.id, entry.id, { title, description, link, fileIds: files.map((f) => f.id), submit }),
    onSuccess: (d, submit) => { set(d); toast.success(submit ? "Submitted — good luck!" : "Saved"); },
    onError: (e) => toast.error(errorOf(e, "Couldn't save")),
  });
  const withdraw = async () => {
    if (!(await askConfirm({ title: "Withdraw your entry?", confirmLabel: "Withdraw", tone: "danger" }))) return;
    try { set(await connectApi.withdrawEntry(c.id, entry.id)); } catch (e) { toast.error(errorOf(e)); }
  };
  if (!c.open || !active) return <EntryCard e={entry} />;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={pill(entry.status === "submitted" ? "good" : "waiting", { justifySelf: "start" })}>{entry.status === "submitted" ? "Submitted — you can still change it" : "Not submitted yet"}</span>
      {entry.mode === "team" && <div style={{ fontSize: 13, color: C.muted }}>Team: {entry.people.map((p) => p.displayName).join(", ")}</div>}
      <label style={label} htmlFor="entry-title">Title</label>
      <input id="entry-title" maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
      <label style={label} htmlFor="entry-desc">What did you make?</label>
      <textarea id="entry-desc" rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} style={input} />
      <label style={label} htmlFor="entry-link">Link (Scratch, GitHub, YouTube…)</label>
      <input id="entry-link" value={link} onChange={(e) => setLink(e.target.value)} style={input} />
      <FileGallery files={files} compact onRemove={(id) => setFiles((fs) => fs.filter((f) => f.id !== id))} />
      <FilePickerButton current={files.length} onUploaded={(f) => setFiles((fs) => [...fs, f])} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <button type="button" style={btn("ghost")} disabled={save.isPending} onClick={() => save.mutate(false)}>Save</button>
        <button type="button" style={btn("primary")} disabled={save.isPending || !title.trim()} onClick={() => save.mutate(true)}>Submit</button>
        <button type="button" style={btn("danger")} onClick={withdraw}>Withdraw</button>
      </div>
    </div>
  );
}

function EnterDialog({ open, onClose, c, set }) {
  const [mode, setMode] = useState(c.entryMode === "team" ? "team" : "individual");
  const [projectId, setProjectId] = useState("");
  const enter = useMutation({
    mutationFn: () => connectApi.enter(c.id, { mode, projectId: mode === "team" ? projectId : null }),
    onSuccess: (d) => { set(d); toast.success("You're in! Add your work and submit it before the end."); onClose(); },
    onError: (e) => toast.error(errorOf(e, "Couldn't enter")),
  });
  return (
    <Modal open={open} title={`Take part in ${c.title}`} onClose={onClose}
      footer={<><button type="button" style={btn("ghost")} onClick={onClose}>Cancel</button><button type="button" style={btn("primary")} disabled={enter.isPending || (mode === "team" && !projectId)} onClick={() => enter.mutate()}>Take part</button></>}>
      {c.entryMode === "both" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Chip active={mode === "individual"} onClick={() => setMode("individual")}>On my own</Chip>
          <Chip active={mode === "team"} onClick={() => setMode("team")}>With my project team</Chip>
        </div>
      )}
      {mode === "team" ? (
        c.myProjects?.length ? (
          <>
            <label style={label} htmlFor="enter-project">Which team?</label>
            <select id="enter-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={input}>
              <option value="">Choose a project team</option>
              {c.myProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <p style={{ fontSize: 13, color: C.muted }}>Everyone on that project's team is in the entry.</p>
          </>
        ) : <p>Team entries use a project team. <Link to={`${CONNECT_BASE}/projects`}>Start a project</Link> and invite your teammates first.</p>
      ) : <p style={{ margin: 0 }}>You'll enter on your own. Add your work and submit it before the challenge ends.</p>}
    </Modal>
  );
}
