import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiChevronDown, FiEdit2, FiMapPin, FiSend, FiVideo } from "react-icons/fi";
import { useCheckinMutation, useCheckinSession } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import RichTextEditor from "../../assessments/components/RichTextEditor";
import RichContent, { isEmptyHtml } from "../../assessments/components/RichContent";
import { SessionTasks } from "../components/Tasks";
// A check-in's template is answered and shown exactly like a QA report's (qa/components).
import { TemplateItem } from "../../qa/components/ReviewForm";
import { ScoreHeader, TemplateAnswers, liveScore } from "../../qa/components/Report";
import { CheckinStyles, FORMAT_LABEL, FREQUENCY_LABEL, PARTICIPANT_KIND, Pill, REPORT_PARTS, STATE, T, btn, card, font, formatDate, formatDateTime, hint, label, reportHtml, safeMeetingLink, useCheckinsBase } from "../shared";

const EMPTY = { highs: "", lows: "", resolutions: "", answers: {} };
const toForm = (session) => ({
  highs: reportHtml(session?.report?.highs), lows: reportHtml(session?.report?.lows), resolutions: reportHtml(session?.report?.resolutions),
  answers: session?.answers || {},
});

// A report, read-only: with a template, its score and every item's answer first; then the highs,
// lows and resolutions.
function ReportView({ report, template, answers, score, sectionScores }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {template && (
        <div style={{ display: "grid", gap: 14, paddingBottom: 14, borderBottom: "1px solid #F3F4F6" }}>
          <p style={{ ...label, margin: 0 }}>{template.name}</p>
          <ScoreHeader score={score} sectionScores={sectionScores} />
          <TemplateAnswers template={template} answers={answers} />
        </div>
      )}
      {REPORT_PARTS.map((part) => (
        <div key={part.key}>
          <p style={{ ...label, marginBottom: 4 }}>{part.label}</p>
          <RichContent html={reportHtml(report?.[part.key])} emptyText="—" />
        </div>
      ))}
    </div>
  );
}

// One check-in: the hub, when, online or in person, who — and its report: with a template (picked
// on its schedule), an answer to each of the template's items and a score, as in a QA report; then
// highs, lows and resolutions. The report can be written from the check-in's day on, by its Account Manager or
// Training Lead (or a manager), and corrected afterwards. Below, the hub's earlier reports.
export default function CheckinSessionPage() {
  const { id } = useParams();
  const base = useCheckinsBase();
  const { data: session, isLoading, isError, error } = useCheckinSession(id);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [problems, setProblems] = useState([]);
  const [openEarlier, setOpenEarlier] = useState(null);

  useEffect(() => {
    if (session && !editing) setForm(toForm(session));
  }, [session, editing]);

  const save = useCheckinMutation((report) => checkinsApi.saveReport(id, report), (r) => (session?.state === "reported" ? "Report updated" : `Report sent for ${r?.hubName || "the hub"}`));

  if (isLoading) return <p style={{ ...hint, fontFamily: font }}>Loading…</p>;
  if (isError || !session) {
    return (
      <div style={{ fontFamily: font }}>
        <Link to={base} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none" }}><FiArrowLeft size={14} /> Hub Check-ins</Link>
        <p style={{ marginTop: 14, color: "#B91C1C", fontSize: 14 }}>{error?.message || "This check-in couldn't be found."}</p>
      </div>
    );
  }

  const { permissions } = session;
  const reported = session.state === "reported";
  const showForm = permissions.canWriteReport && (!reported || editing);
  const template = session.template;
  const unanswered = template ? template.sections.flatMap((s) => s.criteria.filter((c) => c.kind !== "comment" && form.answers?.[c.id]?.value === undefined)) : [];
  const live = template ? liveScore(template, form.answers || {}) : null;
  const submit = () => {
    const missingParts = REPORT_PARTS.filter((p) => isEmptyHtml(form[p.key])).map((p) => p.label.toLowerCase());
    const issues = [];
    if (unanswered.length) issues.push(`Answer ${unanswered.length === 1 ? "1 item" : `${unanswered.length} items`} of the template (or mark them not applicable).`);
    if (missingParts.length) issues.push(`Write the ${missingParts.join(", ")} — write "None" if there were none.`);
    if (issues.length) {
      setProblems(issues);
      return;
    }
    setProblems([]);
    save.mutate(form, { onSuccess: () => setEditing(false), onError: (err) => setProblems((err.errors || []).map((e) => e.message)) });
  };

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16, width: "100%", minWidth: 0 }}>
      <CheckinStyles />
      <Link to={base} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> Hub Check-ins</Link>

      <section style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: T.ink }}>{session.hubName || "Hub"}</h1>
          <Pill look={STATE[session.state]} />
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 13, color: T.inkMuted }}>
          <span>{formatDate(session.scheduledDate)}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{session.format === "online" ? <FiVideo size={13} /> : <FiMapPin size={13} />}{FORMAT_LABEL[session.format]}</span>
          {session.frequency && <span>{FREQUENCY_LABEL[session.frequency]}</span>}
          <span>Account Manager: {session.accountManagerName || "—"}</span>
          <span>Training Lead: {session.trainingLeadName || "—"}</span>
        </div>
        {session.format === "online" && safeMeetingLink(session.meetingLink) && session.state !== "reported" && (
          <a href={safeMeetingLink(session.meetingLink)} target="_blank" rel="noopener noreferrer" className="ci-btn" style={{ ...btn("primary"), marginTop: 12, textDecoration: "none", display: "inline-flex" }}>
            <FiVideo size={14} /> Join the check-in
          </a>
        )}
        {session.participants?.total > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
            <p style={{ ...label, marginBottom: 6 }}>Taking part</p>
            {session.participants.people ? (
              <div style={{ display: "grid", gap: 6 }}>
                {Object.entries(PARTICIPANT_KIND).map(([kind, text]) => {
                  const names = session.participants.people.filter((p) => p.kind === kind).map((p) => p.name);
                  return names.length ? <p key={kind} style={{ margin: 0, fontSize: 13, color: "#374151" }}><strong>{text}:</strong> {names.join(", ")}</p> : null;
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "#374151" }}>
                {Object.entries(PARTICIPANT_KIND).filter(([kind]) => session.participants.counts?.[kind]).map(([kind, text]) => `${text}: ${session.participants.counts[kind]}`).join(" · ")}
              </p>
            )}
          </div>
        )}
      </section>

      <section style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>Report</h2>
            {reported && <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>Sent {formatDateTime(session.reportSubmittedAt)}{session.reportSubmittedByName ? ` by ${session.reportSubmittedByName}` : ""}</p>}
          </div>
          {reported && !showForm && permissions.canWriteReport && (
            <button type="button" className="ci-btn" onClick={() => setEditing(true)} style={btn("secondary")}><FiEdit2 size={14} /> Correct the report</button>
          )}
        </div>

        {session.state === "upcoming" && (
          <p style={{ ...hint, fontSize: 13 }}>This check-in is on {formatDate(session.scheduledDate)}. Its report can be written from that day.</p>
        )}

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
                      <TemplateItem
                        key={c.id}
                        criterion={c}
                        scale={template.scale || []}
                        answer={form.answers?.[c.id]}
                        onChange={(a) => { setEditing(true); setForm((f) => ({ ...f, answers: { ...f.answers, [c.id]: a } })); }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {REPORT_PARTS.map((part) => (
              <div key={part.key}>
                <p style={label}>{part.label}</p>
                <p style={{ ...hint, margin: "0 0 6px" }}>{part.help}</p>
                <RichTextEditor
                  value={form[part.key]}
                  onChange={(html) => { setEditing(true); setForm((f) => ({ ...f, [part.key]: html })); }}
                  minHeight={110}
                  maxHeight={360}
                />
              </div>
            ))}
            {problems.length > 0 && <div style={{ color: "#B91C1C", fontSize: 12.5 }}>{problems.map((p) => <p key={p} style={{ margin: 0 }}>{p}</p>)}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
              {reported && <button type="button" className="ci-btn" onClick={() => { setEditing(false); setProblems([]); setForm(toForm(session)); }} style={btn("secondary")}>Cancel</button>}
              <button type="button" className="ci-btn" onClick={submit} disabled={save.isPending} style={btn("primary", { disabled: save.isPending })}>
                {!reported && <FiSend size={14} />}{save.isPending ? "Sending…" : reported ? "Save changes" : "Send report"}
              </button>
            </div>
          </div>
        ) : reported ? (
          <ReportView report={session.report} template={template} answers={session.answers} score={session.score} sectionScores={session.sectionScores} />
        ) : session.state === "due" && permissions.isParticipantOnly ? (
          <p style={{ ...hint, fontSize: 13 }}>The report will come to you here once {[session.accountManagerName, session.trainingLeadName].filter(Boolean).join(" or ") || "the check-in's Account Manager or Training Lead"} has written it.</p>
        ) : session.state === "due" ? (
          <p style={{ ...hint, fontSize: 13 }}>Waiting for {[session.accountManagerName, session.trainingLeadName].filter(Boolean).join(" or ") || "the check-in's Account Manager or Training Lead"} to write the report.</p>
        ) : null}
      </section>

      {(permissions.canManageTasks || session.tasks?.length > 0) && (
        <section style={{ ...card, overflow: "hidden" }}>
          <SessionTasks session={session} />
        </section>
      )}

      {session.earlierReports?.length > 0 && (
        <section style={{ ...card, overflow: "hidden" }}>
          <h2 style={{ margin: 0, padding: "16px 20px 6px", fontSize: 15, fontWeight: 800, color: T.ink }}>Earlier reports for {session.hubName}</h2>
          {session.earlierReports.map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid #F3F4F6" }}>
              <button type="button" className="ci-tab" onClick={() => setOpenEarlier(openEarlier === r.id ? null : r.id)} aria-expanded={openEarlier === r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", minHeight: 46, padding: "0 20px", border: 0, background: "transparent", cursor: "pointer", fontFamily: font, fontSize: 13, color: T.ink, textAlign: "left" }}>
                <span><strong>{formatDate(r.scheduledDate)}</strong> · {FORMAT_LABEL[r.format]}{r.score != null ? ` · ${r.score}%` : ""}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.accentMid, fontWeight: 700, fontSize: 12.5 }}>
                  {openEarlier === r.id ? "Hide" : "Show"}
                  <FiChevronDown size={15} style={{ transform: openEarlier === r.id ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
                </span>
              </button>
              {openEarlier === r.id && <div style={{ padding: "0 20px 16px" }}><ReportView report={r.report} template={r.template} answers={r.answers} score={r.score} sectionScores={r.sectionScores} /></div>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
