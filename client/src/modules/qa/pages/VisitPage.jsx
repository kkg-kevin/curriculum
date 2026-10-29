import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiEdit2, FiMapPin, FiMessageSquare, FiSlash, FiUser } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import RichTextEditor from "../../assessments/components/RichTextEditor";
import RichContent, { isEmptyHtml } from "../../assessments/components/RichContent";
import { useQaMutation, useQaVisit } from "../hooks/useQa";
import { qaApi } from "../services/qaApi";
import ReviewForm from "../components/ReviewForm";
import VisitDialog from "../components/VisitDialog";
import { ReportView, ScoreHeader, SummaryParts } from "../components/Report";
import { educatorPagePath } from "../components/EducatorsTab";
import {
  Pill, QaStyles, REVIEWER_ROLES, SUMMARY_PARTS, stateLook, ScoreBadge, T, VisitTypePill, btn, card, font, formatDate, formatDateTime, hint, useQaBase, visitPath,
} from "../shared";

// The educator's reply to their report: shown to them with an editor, to reviewers read only.
function ReplyBox({ visit, canReply }) {
  const [editing, setEditing] = useState(!visit.reply);
  const [text, setText] = useState(visit.reply || "");
  const save = useQaMutation((reply) => qaApi.saveReply(visit.id, reply), visit.reply ? "Reply updated" : "Reply sent");
  if (!canReply && !visit.reply) return null;
  return (
    <section style={{ ...card, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, display: "inline-flex", alignItems: "center", gap: 7 }}><FiMessageSquare size={15} /> {canReply ? "Your reply" : "The educator's reply"}</h2>
          {visit.repliedAt && <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{formatDateTime(visit.repliedAt)}</p>}
        </div>
        {canReply && visit.reply && !editing && <button type="button" className="ci-btn" onClick={() => setEditing(true)} style={btn("secondary", { size: "sm" })}><FiEdit2 size={13} /> Change</button>}
      </div>
      {canReply && editing ? (
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ ...hint, margin: 0 }}>Your reviewer and supervisor read this — thank them, add context, or say what you&apos;ll do next.</p>
          <RichTextEditor value={text} onChange={setText} minHeight={100} maxHeight={300} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {visit.reply && <button type="button" className="ci-btn" onClick={() => { setEditing(false); setText(visit.reply); }} style={btn("secondary")}>Cancel</button>}
            <button type="button" className="ci-btn" disabled={save.isPending || isEmptyHtml(text)} onClick={() => save.mutate(text, { onSuccess: () => setEditing(false) })} style={btn("primary", { disabled: save.isPending || isEmptyHtml(text) })}>
              {save.isPending ? "Sending…" : visit.reply ? "Save reply" : "Send reply"}
            </button>
          </div>
        </div>
      ) : (
        <RichContent html={visit.reply || ""} emptyText="No reply yet." />
      )}
    </section>
  );
}

// One QA visit. Reviewers (an admin, the visit's reviewer, the educator's supervisor) fill in and
// send the review, correct it later, move or cancel the visit. The educator reads the report and
// replies; before that, an announced visit shows when it is. The hub sees a summary of the report.
export default function VisitPage() {
  const { id } = useParams();
  const base = useQaBase();
  const { user } = useAuth();
  const { data: visit, isLoading, isError, error } = useQaVisit(id);
  const [editingReport, setEditingReport] = useState(false);
  const [changing, setChanging] = useState(false);
  const save = useQaMutation((body) => qaApi.saveReview(id, body), (r, body) => (body.submit && !editingReport ? `Report sent to ${r.teacherName}` : editingReport ? "Report updated" : "Review saved — finish it any time"));
  const cancel = useQaMutation(() => qaApi.cancelVisit(id), "Visit cancelled");

  const isReviewer = REVIEWER_ROLES.includes(user?.role);
  const isEducator = user?.role === "teacher";
  const backLabel = isReviewer ? "Quality Assurance" : "QA Reviews";

  if (isLoading) return <p style={{ ...hint, fontFamily: font }}>Loading…</p>;
  if (isError || !visit) {
    return (
      <div style={{ fontFamily: font }}>
        <Link to={base} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none" }}><FiArrowLeft size={14} /> {backLabel}</Link>
        <p style={{ marginTop: 14, color: "#B91C1C", fontSize: 14 }}>{error?.message || "This visit couldn't be found."}</p>
      </div>
    );
  }

  const p = visit.permissions || {};
  const submitted = visit.state === "submitted";
  const cancelled = visit.state === "cancelled";
  const onSave = (body, onError) => save.mutate(body, { onSuccess: () => setEditingReport(false), onError });

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16, width: "100%", minWidth: 0, maxWidth: 1080 }}>
      <QaStyles />
      <Link to={base} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> {backLabel}</Link>

      <section style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: T.ink }}>
                {isEducator ? `QA visit — ${formatDate(visit.scheduledDate)}` : isReviewer ? <Link to={educatorPagePath(user?.role, visit.teacherId)} style={{ color: "inherit", textDecoration: "none" }}>{visit.teacherName}</Link> : visit.teacherName}
              </h1>
              <Pill look={stateLook(visit.state, user?.role)} />
              <VisitTypePill type={visit.visitType} />
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 13, color: T.inkMuted }}>
              {!isEducator && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiCalendar size={13} />{formatDate(visit.scheduledDate)}</span>}
              {visit.hubName && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiMapPin size={13} />{visit.hubName}</span>}
              {visit.reviewerName && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiUser size={13} />{visit.reviewerName}</span>}
              {visit.templateName && <span>{visit.templateName}</span>}
            </div>
            {submitted && visit.submittedAt && <p style={{ margin: "6px 0 0", fontSize: 12, color: T.inkMuted }}>Report sent {formatDateTime(visit.submittedAt)}</p>}
          </div>
          {isReviewer && p.canEdit && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="ci-btn" onClick={() => setChanging(true)} style={btn("secondary", { size: "sm" })}><FiEdit2 size={13} /> Change visit</button>
              <button type="button" className="ci-btn" disabled={cancel.isPending} onClick={() => { if (window.confirm(`Cancel this visit to ${visit.teacherName}?${visit.started ? " The review written so far is kept with it, but it won't be sent." : ""}`)) cancel.mutate(); }} style={btn("danger", { size: "sm", disabled: cancel.isPending })}><FiSlash size={13} /> Cancel visit</button>
            </div>
          )}
          {isReviewer && submitted && p.canReview && !editingReport && (
            <button type="button" className="ci-btn" onClick={() => setEditingReport(true)} style={btn("secondary", { size: "sm" })}><FiEdit2 size={13} /> Correct the report</button>
          )}
        </div>
      </section>

      {cancelled && <section style={{ ...card, padding: "16px 20px" }}><p style={{ ...hint, margin: 0, fontSize: 13 }}>This visit was cancelled.</p></section>}

      {/* Reviewers: the form until it's sent (or while correcting), then the report. */}
      {isReviewer && !cancelled && ((!submitted && p.canReview) || editingReport) && (
        <ReviewForm key={editingReport ? "correct" : "review"} visit={visit} onSave={onSave} saving={save.isPending} sent={editingReport} onCancel={() => setEditingReport(false)} />
      )}
      {isReviewer && !submitted && !cancelled && !p.canReview && (
        <section style={{ ...card, padding: "16px 20px" }}><p style={{ ...hint, margin: 0, fontSize: 13 }}>Waiting for {visit.reviewerName || "the reviewer"} to send the report.</p></section>
      )}
      {isReviewer && submitted && !editingReport && <section style={{ ...card, padding: "18px 20px" }}><ReportView visit={visit} /></section>}

      {/* The educator: the report, or when the announced visit is. */}
      {isEducator && !submitted && (
        <section style={{ ...card, padding: "18px 20px" }}>
          <p style={{ margin: 0, fontSize: 14, color: T.ink, lineHeight: 1.6 }}>
            {visit.reviewerName || "Your supervisor"} will visit{visit.hubName ? ` you at ${visit.hubName}` : ""} on <strong>{formatDate(visit.scheduledDate)}</strong>
            {visit.templateName ? <> to look at how your classes are going ({visit.templateName}).</> : " to look at how your classes are going."}
          </p>
          <p style={{ ...hint, marginTop: 8 }}>Teach as you normally would. Once the visit is done you&apos;ll get the report here, and can reply to it.</p>
        </section>
      )}
      {isEducator && submitted && <section style={{ ...card, padding: "18px 20px" }}><ReportView visit={visit} /></section>}

      {/* The hub: a summary only. */}
      {!isReviewer && !isEducator && submitted && (
        <section style={{ ...card, padding: "18px 20px", display: "grid", gap: 18 }}>
          <ScoreHeader score={visit.score} sectionScores={visit.sectionScores} />
          <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 14 }}>
            <SummaryParts summary={visit.summary} parts={SUMMARY_PARTS.filter((part) => part.key !== "remarks")} />
          </div>
          <p style={{ ...hint, margin: 0 }}>A summary of the report. The educator and their supervisor have the full report.</p>
        </section>
      )}
      {!isReviewer && !isEducator && !submitted && (
        <section style={{ ...card, padding: "18px 20px" }}>
          <p style={{ margin: 0, fontSize: 14, color: T.ink }}>{visit.reviewerName || "A supervisor"} will visit {visit.teacherName} on <strong>{formatDate(visit.scheduledDate)}</strong>. A summary of the report shows here once it&apos;s sent.</p>
        </section>
      )}

      {submitted && (isEducator || isReviewer) && <ReplyBox key={visit.repliedAt || "none"} visit={visit} canReply={isEducator && p.canReply} />}

      {isReviewer && visit.earlier?.length > 0 && (
        <section style={{ ...card, overflow: "hidden" }}>
          <h2 style={{ margin: 0, padding: "16px 20px 8px", fontSize: 15, fontWeight: 800, color: T.ink }}>Earlier reports for {visit.teacherName}</h2>
          {visit.earlier.map((e) => (
            <Link key={e.id} to={visitPath(base, e.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 20px", borderTop: "1px solid #F3F4F6", textDecoration: "none", color: T.ink, fontSize: 13 }}>
              <span><strong>{formatDate(e.scheduledDate)}</strong>{e.reviewerName ? ` · ${e.reviewerName}` : ""}</span>
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><VisitTypePill type={e.visitType} /><ScoreBadge score={e.score} /></span>
            </Link>
          ))}
        </section>
      )}

      {changing && <VisitDialog visit={visit} onClose={() => setChanging(false)} />}
    </div>
  );
}
