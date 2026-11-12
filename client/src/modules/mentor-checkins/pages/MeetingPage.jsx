import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiClock, FiEdit2, FiMapPin, FiMove, FiRotateCcw, FiSend, FiSlash, FiThumbsUp, FiUserX, FiVideo } from "react-icons/fi";
import { useMeeting, useMentorMutation } from "../hooks/useMentorCheckins";
import { mentorCheckinsApi } from "../services/mentorCheckinsApi";
import TimePickerDialog from "../components/TimePickerDialog";
import RichTextEditor from "../../assessments/components/RichTextEditor";
import RichContent, { isEmptyHtml } from "../../assessments/components/RichContent";
// A check-in's template is answered and shown exactly like a QA report's (qa/components).
import { TemplateItem } from "../../qa/components/ReviewForm";
import { ScoreHeader, TemplateAnswers, liveScore } from "../../qa/components/Report";
import { CheckinStyles, FORMAT_LABEL, Pill, REPORT_PARTS, T, btn, card, childNames, font, formatDate, formatDateTime, hint, input, label, reportHtml, safeMeetingLink, stateFor, useMentorBase } from "../shared";
import RecordStamp from "../../activity/components/RecordStamp";

import { askConfirm } from "../../../components/ui/AskDialog";
const toForm = (m) => ({ summary: reportHtml(m?.report?.summary), actions: reportHtml(m?.report?.actions), answers: m?.answers || {} });

// The report, read only: the template's score and answers, then the two written parts.
function ReportView({ meeting }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {meeting.template && (
        <div style={{ display: "grid", gap: 14, paddingBottom: 14, borderBottom: "1px solid #F3F4F6" }}>
          <p style={{ ...label, margin: 0 }}>{meeting.template.name}</p>
          <ScoreHeader score={meeting.score} sectionScores={meeting.sectionScores} />
          <TemplateAnswers template={meeting.template} answers={meeting.answers} />
        </div>
      )}
      {REPORT_PARTS.map((part) => (
        <div key={part.key}>
          <p style={{ ...label, marginBottom: 4 }}>{part.label}</p>
          <RichContent html={reportHtml(meeting.report?.[part.key])} emptyText="—" />
        </div>
      ))}
    </div>
  );
}

// One parent–mentor check-in. Everyone with access sees when, where, who and where it stands.
//   parent    Confirm, or Pick another time (free times only); Join on the day; afterwards the
//             report, and Approve (with a note, optionally).
//   educator  the report (template items, how the child is doing, what was agreed), from the day
//             on — correctable until the parent approves it; or Mark missed.
//   manager   all of that, plus Move and Cancel.
//   hub / supervisor  when and where it stands only.
export default function MeetingPage() {
  const { id } = useParams();
  const base = useMentorBase();
  const { data: m, isLoading, isError, error } = useMeeting(id);
  const [form, setForm] = useState(toForm(null));
  const [editing, setEditing] = useState(false);
  const [problems, setProblems] = useState([]);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => { if (m && !editing) setForm(toForm(m)); }, [m, editing]);

  const confirm = useMentorMutation(() => mentorCheckinsApi.confirm(id), "Thanks — your time is confirmed");
  const approve = useMentorMutation(() => mentorCheckinsApi.approve(id, { comment: note.trim() || null }), "Thank you — the report is approved");
  const missed = useMentorMutation((value) => mentorCheckinsApi.setMissed(id, value), (r) => (r.state === "missed" ? "Marked missed" : "Back to be written up"));
  const cancel = useMentorMutation(() => mentorCheckinsApi.cancelMeeting(id), "Check-in cancelled — the family has been told");
  const save = useMentorMutation((body) => mentorCheckinsApi.saveReport(id, body), () => (m?.reportSubmittedAt ? "Report updated" : "Report sent to the parent"), { toastErrors: false });

  if (isLoading) return <p style={{ ...hint, fontFamily: font }}>Loading…</p>;
  if (isError || !m) {
    return (
      <div style={{ fontFamily: font }}>
        <Link to={base} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none" }}><FiArrowLeft size={14} /> Back</Link>
        <p style={{ marginTop: 14, color: "#B91C1C", fontSize: 14 }}>{error?.message || "This check-in couldn't be found."}</p>
      </div>
    );
  }

  const can = m.permissions;
  const viewer = can.viewer;
  const asParent = viewer === "parent";
  const reported = Boolean(m.reportSubmittedAt);
  const showForm = can.canWriteReport && (!reported || editing);
  // Written before the planned day (the family came in early) — allowed; said so, so it's on purpose.
  const early = m.state === "upcoming" && !reported;
  const template = m.template;
  const unanswered = template ? template.sections.flatMap((s) => s.criteria.filter((c) => c.kind !== "comment" && form.answers?.[c.id]?.value === undefined)) : [];
  const live = template ? liveScore(template, form.answers || {}) : null;
  const join = m.format === "online" && ["upcoming", "today"].includes(m.state) ? safeMeetingLink(m.meetingLink) : null;
  const title = asParent ? `Check-in about ${childNames(m) || "your child"}` : `${m.parentName} · ${childNames(m)}`;

  const submit = () => {
    const missing = REPORT_PARTS.filter((p) => isEmptyHtml(form[p.key])).map((p) => `"${p.label}"`);
    const issues = [];
    if (unanswered.length) issues.push(`Answer ${unanswered.length === 1 ? "1 item" : `${unanswered.length} items`} of the template (or mark them not applicable).`);
    if (missing.length) issues.push(`Write ${missing.join(" and ")} — write "None" if there's nothing to say.`);
    if (issues.length) { setProblems(issues); return; }
    setProblems([]);
    save.mutate(form, { onSuccess: () => setEditing(false), onError: (err) => setProblems(err?.errors?.length ? err.errors.map((e) => e.message) : [err?.message || "The report couldn't be sent"]) });
  };

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16, width: "100%", minWidth: 0 }}>
      <CheckinStyles />
      <Link to={base} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> {asParent ? "Mentor Check-ins" : "Parent–Mentor Check-ins"}</Link>

      <section style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: T.ink }}>{title}</h1>
          <Pill look={stateFor(m.state, viewer)} />
          {["upcoming", "today"].includes(m.state) && m.confirmed && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: "#047857" }}><FiCheckCircle size={13} /> Confirmed</span>}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 13, color: T.inkMuted }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiCalendar size={13} /> {formatDate(m.date)}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiClock size={13} /> {m.startTime}–{m.endTime}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{m.format === "online" ? <FiVideo size={13} /> : <FiMapPin size={13} />}{m.format === "online" ? FORMAT_LABEL.online : m.location || FORMAT_LABEL.in_person}</span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
          <strong>{asParent ? "With" : "Educators"}:</strong> {m.educatorNames.join(", ") || "—"} · {m.className}{m.hubName ? `, ${m.hubName}` : ""}
          {!asParent && <><br /><strong>Parent:</strong> {m.parentName}</>}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {join && (
            <a href={join} target="_blank" rel="noopener noreferrer" className="ci-btn" style={{ ...btn("primary"), background: "#047857", borderColor: "#047857", textDecoration: "none" }}><FiVideo size={14} /> Join the check-in</a>
          )}
          {can.canConfirm && <button type="button" className="ci-btn" disabled={confirm.isPending} onClick={() => confirm.mutate()} style={btn("primary", { disabled: confirm.isPending })}><FiCheckCircle size={14} /> Confirm this time</button>}
          {can.canChangeTime && <button type="button" className="ci-btn" onClick={() => setPicking(true)} style={btn("secondary")}><FiMove size={14} /> Pick another time</button>}
          {can.canMove && <button type="button" className="ci-btn" onClick={() => setPicking(true)} style={btn("secondary")}><FiMove size={14} /> Move</button>}
          {can.canCancel && <button type="button" className="ci-btn" disabled={cancel.isPending} onClick={async () => { if (await askConfirm({ title: "Cancel this check-in?", message: "The family is told.", confirmLabel: "Cancel check-in", cancelLabel: "Keep it", tone: "danger" })) cancel.mutate(); }} style={btn("danger", { disabled: cancel.isPending })}><FiSlash size={14} /> Cancel</button>}
        </div>
        {asParent && m.state === "today" && <p style={{ ...hint, marginTop: 10 }}>It&apos;s today, so the time can&apos;t change now. If you can&apos;t make it, let the hub know.</p>}
        {asParent && m.state === "upcoming" && !m.confirmed && <p style={{ ...hint, marginTop: 10 }}>Confirm the time, or pick another free time if this one doesn&apos;t suit you.</p>}
      </section>
      {/* Who created it, who changed it last (admin side only — modules/activity). */}
      <RecordStamp type="mentor_checkin_meetings" id={id} />

      {/* The report — not for the hub or a supervisor. */}
      {(viewer === "parent" || viewer === "educator" || viewer === "manager") && m.state !== "cancelled" && (
        <section style={{ ...card, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>Report</h2>
              {reported && <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>Written {formatDateTime(m.reportSubmittedAt)}{m.reportSubmittedByName ? ` by ${m.reportSubmittedByName}` : ""}{m.approvedAt ? ` · approved ${formatDateTime(m.approvedAt)}` : ""}</p>}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {reported && !showForm && can.canWriteReport && <button type="button" className="ci-btn" onClick={() => setEditing(true)} style={btn("secondary")}><FiEdit2 size={14} /> Correct the report</button>}
              {can.canMarkMissed && !showForm && <button type="button" className="ci-btn" disabled={missed.isPending} onClick={() => missed.mutate(true)} style={btn("secondary")}><FiUserX size={14} /> Mark missed</button>}
              {can.canUndoMissed && <button type="button" className="ci-btn" disabled={missed.isPending} onClick={() => missed.mutate(false)} style={btn("secondary")}><FiRotateCcw size={14} /> Not missed after all</button>}
            </div>
          </div>

          {m.state === "upcoming" && (
            <p style={{ ...hint, fontSize: 13 }}>
              {asParent
                ? "After the check-in, the mentor writes it up here for you to read and approve — even if you meet before the planned day."
                : early && can.canWriteReport
                  ? `Planned for ${formatDate(m.date)}. Met the family already (they came in early)? Write it up now — they can read and approve it straight away.`
                  : `Planned for ${formatDate(m.date)}.`}
            </p>
          )}
          {m.state === "missed" && <p style={{ ...hint, fontSize: 13 }}>This check-in didn&apos;t happen.</p>}

          {showForm ? (
            <div style={{ display: "grid", gap: 14 }}>
              {template && (
                <div style={{ display: "grid", gap: 12, paddingBottom: 14, borderBottom: "1px solid #F3F4F6" }}>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ ...label, margin: 0 }}>{template.name}</p>
                    {unanswered.length > 0 && <span style={{ ...hint, margin: 0 }}>{unanswered.length} {unanswered.length === 1 ? "item" : "items"} still to answer</span>}
                  </div>
                  {!isEmptyHtml(template.description) && <div style={{ fontSize: 13, color: T.inkMuted }}><RichContent html={reportHtml(template.description)} /></div>}
                  <ScoreHeader score={live.score} sectionScores={live.sectionScores} />
                  {template.sections.map((sec) => (
                    <div key={sec.id} style={{ display: "grid", gap: 10 }}>
                      <h3 style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: T.ink }}>{sec.title}</h3>
                      {sec.criteria.map((c) => (
                        <TemplateItem key={c.id} criterion={c} scale={template.scale || []} answer={form.answers?.[c.id]}
                          onChange={(a) => { setEditing(true); setForm((f) => ({ ...f, answers: { ...f.answers, [c.id]: a } })); }} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {REPORT_PARTS.map((part) => (
                <div key={part.key}>
                  <p style={label}>{part.label}</p>
                  <p style={{ ...hint, margin: "0 0 6px" }}>{part.help}</p>
                  <RichTextEditor value={form[part.key]} onChange={(html) => { setEditing(true); setForm((f) => ({ ...f, [part.key]: html })); }} minHeight={110} maxHeight={360} />
                </div>
              ))}
              <p style={{ ...hint, margin: 0 }}>The parent reads the whole report and approves it. You can correct it until they do.</p>
              {problems.length > 0 && <div style={{ color: "#B91C1C", fontSize: 12.5 }}>{problems.map((p) => <p key={p} style={{ margin: 0 }}>{p}</p>)}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
                {reported && <button type="button" className="ci-btn" onClick={() => { setEditing(false); setProblems([]); setForm(toForm(m)); }} style={btn("secondary")}>Cancel</button>}
                <button type="button" className="ci-btn" onClick={submit} disabled={save.isPending} style={btn("primary", { disabled: save.isPending })}>
                  {!reported && <FiSend size={14} />}{save.isPending ? "Sending…" : reported ? "Save changes" : "Send to the parent"}
                </button>
              </div>
            </div>
          ) : reported ? (
            <ReportView meeting={m} />
          ) : ["today", "report_due"].includes(m.state) ? (
            <p style={{ ...hint, fontSize: 13 }}>{asParent ? "The mentor will write it up here for you to read and approve." : "Waiting for one of the educators to write it up."}</p>
          ) : null}

          {/* The parent's approval. */}
          {reported && asParent && can.canApprove && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6", display: "grid", gap: 10 }}>
              <label htmlFor="mc-note" style={{ ...label, margin: 0 }}>Anything to add? <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span></label>
              <textarea id="mc-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} style={{ ...input, resize: "vertical" }} placeholder="A note for the mentor" />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="ci-btn" disabled={approve.isPending} onClick={() => approve.mutate()} style={btn("primary", { disabled: approve.isPending })}><FiThumbsUp size={14} /> {approve.isPending ? "Approving…" : "I've read it — approve"}</button>
              </div>
            </div>
          )}
          {m.approvedAt && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#047857", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><FiCheckCircle size={14} /> {asParent ? "You approved this report" : `${m.parentName} approved this report`} · {formatDateTime(m.approvedAt)}</p>
              {m.parentComment && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>&ldquo;{m.parentComment}&rdquo;</p>}
            </div>
          )}
        </section>
      )}
      {picking && <TimePickerDialog meeting={m} asParent={asParent} onClose={() => setPicking(false)} />}
    </div>
  );
}
