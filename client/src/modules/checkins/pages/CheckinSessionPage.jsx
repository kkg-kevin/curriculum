import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiMapPin, FiPlus, FiVideo } from "react-icons/fi";
import { useCheckinMutation, useCheckinSession } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import { ActionRow } from "../components/Rows";
import ActionDialog from "../components/ActionDialog";
import ActionFormDialog from "../components/ActionFormDialog";
import {
  FORMAT_LABEL, FREQUENCY_LABEL, Modal, OPERATIONAL_STATUS, OVERALL_STATUS, Pill, SESSION_STATUS, T, card, dangerBtn, font, formatDate, formatDateTime,
  ghostBtn, hint, input, label, primaryBtn,
} from "../shared";

const EMPTY_REPORT = {
  session: { actualDate: "", participants: [] },
  operations: { generalStatus: "", dayToDay: "", staffing: "", facilities: "", other: "" },
  training: { curriculumProgress: "", educatorPreparedness: "", learnerEngagement: "", challenges: "", other: "" },
  achievements: { workingWell: "", recent: "", improvements: "", goodPractices: "" },
  decisions: { nextSteps: "", escalations: "" },
  summary: { overallStatus: "", observations: "", recommendedFollowUp: "", proposedNextDate: "" },
};

// The stored report merged over the empty shape, nulls as "".
function toForm(report) {
  const out = {};
  for (const [section, fields] of Object.entries(EMPTY_REPORT)) {
    out[section] = {};
    for (const [key, empty] of Object.entries(fields)) {
      const value = report?.[section]?.[key];
      out[section][key] = value == null ? empty : value;
    }
  }
  return out;
}

// What's sent: empty text becomes null, so a draft can be saved half done.
function toBody(form) {
  const out = {};
  for (const [section, fields] of Object.entries(form)) {
    out[section] = {};
    for (const [key, value] of Object.entries(fields)) out[section][key] = Array.isArray(value) ? value : value === "" ? null : value;
  }
  return out;
}

const HISTORY_LABEL = {
  generated: "Put on the calendar", report_started: "Report started", report_submitted: "Report submitted", report_reopened: "Report reopened",
  rescheduled: "Moved", cancelled: "Cancelled",
};

function Section({ letter, title, children, note }) {
  return (
    <section style={{ ...card, padding: "16px 18px" }}>
      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: T.ink }}><span style={{ color: T.accentMid }}>{letter}.</span> {title}</h3>
      {note && <p style={{ ...hint, marginTop: 2 }}>{note}</p>}
      <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>{children}</div>
    </section>
  );
}

function TextArea({ id, title, value, onChange, readOnly, rows = 3, full = false }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label htmlFor={id} style={label}>{title}</label>
      {readOnly ? (
        <p style={{ margin: 0, fontSize: 13, color: value ? "#374151" : T.inkFaint, whiteSpace: "pre-wrap" }}>{value || "—"}</p>
      ) : (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={4000} style={{ ...input, resize: "vertical" }} />
      )}
    </div>
  );
}

function RescheduleDialog({ session, onClose }) {
  const [date, setDate] = useState(session.scheduledDate);
  const [startTime, setStartTime] = useState(session.startTime);
  const [reason, setReason] = useState("");
  const move = useCheckinMutation((body) => checkinsApi.reschedule(session.id, body), "Check-in moved");
  return (
    <Modal title="Move this check-in" onClose={onClose} width={460} footer={<>
      <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
      <button type="button" disabled={move.isPending || reason.trim().length < 3} onClick={() => move.mutate({ date, startTime, reason: reason.trim() }, { onSuccess: onClose })} style={primaryBtn(move.isPending || reason.trim().length < 3)}>Move</button>
    </>}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <div><label htmlFor="rs-date" style={label}>New date</label><input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} /></div>
        <div><label htmlFor="rs-time" style={label}>Time</label><input id="rs-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={input} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label htmlFor="rs-why" style={label}>Why it&apos;s moving</label><input id="rs-why" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} style={input} /></div>
      </div>
      <p style={hint}>Only this check-in moves. The others in its schedule stay as they are.</p>
    </Modal>
  );
}

// One check-in: when and how, who, its agenda, the report (A–G), its issues and follow-ups, the
// unresolved ones from this hub's earlier check-ins, and what happened to it.
export default function CheckinSessionPage() {
  const { id } = useParams();
  const { data: session, isLoading, isError, error } = useCheckinSession(id);
  const [form, setForm] = useState(EMPTY_REPORT);
  const [dirty, setDirty] = useState(false);
  const [problems, setProblems] = useState([]);
  const [participant, setParticipant] = useState("");
  const [dialog, setDialog] = useState(null); // { kind: "add", type } | { kind: "action", id } | { kind: "reschedule" }

  useEffect(() => {
    if (session && !dirty) setForm(toForm(session.report));
  }, [session, dirty]);

  const save = useCheckinMutation((report) => checkinsApi.saveReport(id, report), "Draft saved");
  const submit = useCheckinMutation(async (report) => {
    await checkinsApi.saveReport(id, report);
    return checkinsApi.submitReport(id);
  }, "Report submitted — the check-in is complete");
  const cancel = useCheckinMutation((reason) => checkinsApi.cancel(id, reason), "Check-in cancelled");
  const reopen = useCheckinMutation((reason) => checkinsApi.reopenReport(id, reason), "Report reopened");

  if (isLoading) return <p style={{ ...hint, fontFamily: font }}>Loading…</p>;
  if (isError || !session) {
    return (
      <div style={{ fontFamily: font }}>
        <Link to="/checkins" style={{ color: T.accentMid, fontSize: 13 }}>← Hub check-ins</Link>
        <p style={{ color: "#B91C1C" }}>{error?.message || "This check-in couldn't be loaded."}</p>
      </div>
    );
  }

  const p = session.permissions;
  const editable = p.canWriteReport;
  const set = (section, key) => (value) => { setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } })); setDirty(true); };
  const busy = save.isPending || submit.isPending;
  const onSave = () => save.mutate(toBody(form), { onSuccess: () => setDirty(false) });
  const onSubmit = () => {
    setProblems([]);
    if (!window.confirm("Submit the report? This completes the check-in. Its issues and follow-ups stay open until they're resolved.")) return;
    submit.mutate(toBody(form), {
      onSuccess: () => setDirty(false),
      // Keep what was typed: the draft may have saved, but nothing is reloaded over the form.
      onError: (err) => setProblems((err.errors || []).map((e) => e.message)),
    });
  };
  const addParticipant = () => {
    const name = participant.trim();
    if (!name) return;
    set("session", "participants")([...(form.session.participants || []), name]);
    setParticipant("");
  };
  const issues = session.actions.filter((a) => a.kind === "issue");
  const followUps = session.actions.filter((a) => a.kind === "action");

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16 }}>
      <Link to="/checkins" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.accentMid, fontSize: 13, fontWeight: 600, textDecoration: "none" }}><FiArrowLeft size={14} /> Hub check-ins</Link>

      {/* Details */}
      <section style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: T.ink }}>{session.hubName}</h1>
              <Pill look={SESSION_STATUS[session.status]} />
              {session.overallStatus && <Pill look={OVERALL_STATUS[session.overallStatus]} />}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#374151" }}>
              {formatDate(session.scheduledDate)} at {session.startTime}{session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
              {session.schedule ? ` · ${FREQUENCY_LABEL[session.schedule.frequency]}` : ""}
              {session.occurrenceDate !== session.scheduledDate ? ` · originally ${formatDate(session.occurrenceDate)}` : ""}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {session.format === "online" ? <FiVideo size={13} /> : <FiMapPin size={13} />}
              {FORMAT_LABEL[session.format]}
              {session.format === "online" && session.meetingLink && <a href={session.meetingLink} target="_blank" rel="noopener noreferrer" style={{ color: T.accentMid, fontWeight: 600 }}>Join the meeting</a>}
              {session.format === "in_person" && session.venue && <span>· {session.venue}</span>}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>Account Manager: <strong style={{ color: T.ink }}>{session.accountManagerName || "—"}</strong> · Training Lead: <strong style={{ color: T.ink }}>{session.trainingLeadName || "—"}</strong></p>
            {session.cancelReason && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#B91C1C" }}>Cancelled: {session.cancelReason}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.canReschedule && <button type="button" onClick={() => setDialog({ kind: "reschedule" })} style={ghostBtn}>Move</button>}
            {p.canCancel && <button type="button" disabled={cancel.isPending} onClick={() => { const reason = window.prompt("Cancel this check-in? Give a reason:"); if (reason && reason.trim().length >= 3) cancel.mutate(reason.trim()); }} style={dangerBtn}>Cancel check-in</button>}
            {p.canReopen && <button type="button" disabled={reopen.isPending} onClick={() => { const reason = window.prompt("Reopen the submitted report so it can be changed? Give a reason:"); if (reason && reason.trim().length >= 3) reopen.mutate(reason.trim()); }} style={ghostBtn}>Reopen report</button>}
          </div>
        </div>
        {session.agenda && <p style={{ margin: "12px 0 0", padding: "10px 12px", borderRadius: 10, background: T.tint, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}><strong>Agenda:</strong> {session.agenda}</p>}
        {session.reportSubmittedAt && <p style={{ ...hint, marginTop: 10 }}>Report submitted {formatDateTime(session.reportSubmittedAt)}{session.reportSubmittedByName ? ` by ${session.reportSubmittedByName}` : ""}.</p>}
      </section>

      {session.earlierOpenActions.length > 0 && (
        <section style={{ ...card, overflow: "hidden" }}>
          <h3 style={{ margin: 0, padding: "14px 18px 4px", fontSize: 14, fontWeight: 800, color: T.ink }}>Still open from earlier check-ins · {session.earlierOpenActions.length}</h3>
          <p style={{ ...hint, padding: "0 18px 8px" }}>Follow up on these during this check-in.</p>
          {session.earlierOpenActions.map((a) => <ActionRow key={a.id} action={a} showHub={false} onOpen={(aid) => setDialog({ kind: "action", id: aid })} />)}
        </section>
      )}

      {/* Report */}
      <Section letter="A" title="Session details">
        <div>
          <label htmlFor="r-date" style={label}>Date it actually took place</label>
          {editable ? <input id="r-date" type="date" value={form.session.actualDate || ""} onChange={(e) => set("session", "actualDate")(e.target.value)} style={input} /> : <p style={{ margin: 0, fontSize: 13 }}>{form.session.actualDate ? formatDate(form.session.actualDate) : "—"}</p>}
        </div>
        <div>
          <label htmlFor="r-part" style={label}>Participants</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: editable ? 6 : 0 }}>
            {(form.session.participants || []).map((name, i) => (
              <span key={`${name}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: "#EEF3F8", fontSize: 12.5 }}>
                {name}
                {editable && <button type="button" aria-label={`Remove ${name}`} onClick={() => set("session", "participants")(form.session.participants.filter((_, j) => j !== i))} style={{ border: 0, background: "none", cursor: "pointer", color: T.inkMuted, padding: 0 }}>×</button>}
              </span>
            ))}
            {!editable && !(form.session.participants || []).length && <span style={{ fontSize: 13, color: T.inkFaint }}>—</span>}
          </div>
          {editable && (
            <div style={{ display: "flex", gap: 6 }}>
              <input id="r-part" value={participant} onChange={(e) => setParticipant(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(); } }} placeholder="Name, then Enter" maxLength={150} style={input} />
              <button type="button" onClick={addParticipant} style={ghostBtn}>Add</button>
            </div>
          )}
        </div>
      </Section>

      <Section letter="B" title="Hub operations">
        <div>
          <label htmlFor="r-ops" style={label}>General operational status</label>
          {editable ? (
            <select id="r-ops" value={form.operations.generalStatus || ""} onChange={(e) => set("operations", "generalStatus")(e.target.value)} style={input}>
              <option value="">Choose…</option>
              {Object.entries(OPERATIONAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          ) : <p style={{ margin: 0, fontSize: 13 }}>{OPERATIONAL_STATUS[form.operations.generalStatus] || "—"}</p>}
        </div>
        <TextArea id="r-day" title="Day-to-day running" value={form.operations.dayToDay} onChange={set("operations", "dayToDay")} readOnly={!editable} />
        <TextArea id="r-staff" title="Staffing and resources" value={form.operations.staffing} onChange={set("operations", "staffing")} readOnly={!editable} />
        <TextArea id="r-fac" title="Facilities, equipment, logistics" value={form.operations.facilities} onChange={set("operations", "facilities")} readOnly={!editable} />
        <TextArea id="r-opother" title="Other operational observations" value={form.operations.other} onChange={set("operations", "other")} readOnly={!editable} />
      </Section>

      <Section letter="C" title="Training and learning">
        <TextArea id="r-curr" title="Curriculum delivery progress" value={form.training.curriculumProgress} onChange={set("training", "curriculumProgress")} readOnly={!editable} />
        <TextArea id="r-edu" title="Educator preparedness and support needs" value={form.training.educatorPreparedness} onChange={set("training", "educatorPreparedness")} readOnly={!editable} />
        <TextArea id="r-eng" title="Learner engagement and participation" value={form.training.learnerEngagement} onChange={set("training", "learnerEngagement")} readOnly={!editable} />
        <TextArea id="r-tch" title="Training-related challenges" value={form.training.challenges} onChange={set("training", "challenges")} readOnly={!editable} />
        <TextArea id="r-trother" title="Other training observations" value={form.training.other} onChange={set("training", "other")} readOnly={!editable} />
      </Section>

      <Section letter="D" title="Achievements and positive outcomes">
        <TextArea id="r-well" title="What is working well" value={form.achievements.workingWell} onChange={set("achievements", "workingWell")} readOnly={!editable} />
        <TextArea id="r-rec" title="Recent achievements" value={form.achievements.recent} onChange={set("achievements", "recent")} readOnly={!editable} />
        <TextArea id="r-imp" title="Improvements observed" value={form.achievements.improvements} onChange={set("achievements", "improvements")} readOnly={!editable} />
        <TextArea id="r-good" title="Good practices worth noting" value={form.achievements.goodPractices} onChange={set("achievements", "goodPractices")} readOnly={!editable} />
      </Section>

      <section style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "16px 18px 8px", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: T.ink }}><span style={{ color: T.accentMid }}>E.</span> Challenges and concerns</h3>
            <p style={{ ...hint, marginTop: 2 }}>Each issue is tracked on its own, after this check-in is done.</p>
          </div>
          {p.canAddActions && <button type="button" onClick={() => setDialog({ kind: "add", type: "issue" })} style={ghostBtn}><FiPlus size={14} /> Add an issue</button>}
        </div>
        {issues.length === 0 ? <p style={{ ...hint, padding: "0 18px 14px" }}>No issues raised.</p> : issues.map((a) => <ActionRow key={a.id} action={a} showHub={false} onOpen={(aid) => setDialog({ kind: "action", id: aid })} />)}
      </section>

      <section style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "16px 18px 8px", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: T.ink }}><span style={{ color: T.accentMid }}>F.</span> Decisions and follow-up</h3>
            <p style={{ ...hint, marginTop: 2 }}>Each follow-up needs a responsible person and a date.</p>
          </div>
          {p.canAddActions && <button type="button" onClick={() => setDialog({ kind: "add", type: "action" })} style={ghostBtn}><FiPlus size={14} /> Add a follow-up</button>}
        </div>
        {followUps.map((a) => <ActionRow key={a.id} action={a} showHub={false} onOpen={(aid) => setDialog({ kind: "action", id: aid })} />)}
        <div style={{ padding: "12px 18px 16px", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
          <TextArea id="r-next" title="Agreed next steps" value={form.decisions.nextSteps} onChange={set("decisions", "nextSteps")} readOnly={!editable} />
          <TextArea id="r-esc" title="Issues needing escalation" value={form.decisions.escalations} onChange={set("decisions", "escalations")} readOnly={!editable} />
        </div>
      </section>

      <Section letter="G" title="Summary">
        <div>
          <label htmlFor="r-overall" style={label}>Overall hub status</label>
          {editable ? (
            <select id="r-overall" value={form.summary.overallStatus || ""} onChange={(e) => set("summary", "overallStatus")(e.target.value)} style={input}>
              <option value="">Choose…</option>
              {Object.entries(OVERALL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          ) : (form.summary.overallStatus ? <Pill look={OVERALL_STATUS[form.summary.overallStatus]} /> : <p style={{ margin: 0, fontSize: 13 }}>—</p>)}
        </div>
        <div>
          <label htmlFor="r-nextdate" style={label}>Proposed next check-in</label>
          {editable ? <input id="r-nextdate" type="date" value={form.summary.proposedNextDate || ""} onChange={(e) => set("summary", "proposedNextDate")(e.target.value)} style={input} /> : <p style={{ margin: 0, fontSize: 13 }}>{form.summary.proposedNextDate ? formatDate(form.summary.proposedNextDate) : "—"}</p>}
        </div>
        <TextArea id="r-obs" title="General observations" value={form.summary.observations} onChange={set("summary", "observations")} readOnly={!editable} full />
        <TextArea id="r-recfu" title="Recommended follow-up" value={form.summary.recommendedFollowUp} onChange={set("summary", "recommendedFollowUp")} readOnly={!editable} full />
      </Section>

      {editable && (
        <section style={{ ...card, padding: "14px 18px", position: "sticky", bottom: 12, zIndex: 5, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: dirty ? "#B45309" : T.inkMuted, flex: 1, minWidth: 180 }}>{dirty ? "Unsaved changes" : session.reportStatus === "draft" ? "Draft saved" : "Not started"}</span>
          <button type="button" onClick={onSave} disabled={busy || !dirty} style={{ ...ghostBtn, opacity: busy || !dirty ? 0.6 : 1 }}>{save.isPending ? "Saving…" : "Save draft"}</button>
          {p.canSubmit && <button type="button" onClick={onSubmit} disabled={busy} style={primaryBtn(busy)}>{submit.isPending ? "Submitting…" : "Submit report"}</button>}
          {problems.length > 0 && (
            <ul style={{ flexBasis: "100%", margin: 0, paddingLeft: 18, color: "#B91C1C", fontSize: 12.5 }}>
              {problems.map((pr) => <li key={pr}>{pr}</li>)}
            </ul>
          )}
        </section>
      )}

      <section style={{ ...card, padding: "14px 18px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: T.ink }}>History</h3>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
          {session.history.map((h, i) => (
            <li key={`${h.at}-${i}`} style={{ fontSize: 12.5, color: "#374151" }}>
              <span style={{ color: T.inkFaint }}>{formatDateTime(h.at)}</span> · {h.event.startsWith("status:") ? `Became ${SESSION_STATUS[h.event.slice(7)]?.label || h.event.slice(7)}` : HISTORY_LABEL[h.event] || h.event}
              {h.byName ? ` — ${h.byName}` : ""}{h.detail ? ` (${h.detail})` : ""}
            </li>
          ))}
        </ol>
      </section>

      {dialog?.kind === "reschedule" && <RescheduleDialog session={session} onClose={() => setDialog(null)} />}
      {dialog?.kind === "add" && <ActionFormDialog sessionId={session.id} kind={dialog.type} onClose={() => setDialog(null)} />}
      {dialog?.kind === "action" && <ActionDialog actionId={dialog.id} onClose={() => setDialog(null)} />}
    </div>
  );
}
