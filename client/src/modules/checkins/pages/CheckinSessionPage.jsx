import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiChevronDown, FiEdit2, FiMapPin, FiSend, FiVideo } from "react-icons/fi";
import { useCheckinMutation, useCheckinSession } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import RichTextEditor from "../../assessments/components/RichTextEditor";
import RichContent, { isEmptyHtml } from "../../assessments/components/RichContent";
import { SessionTasks } from "../components/Tasks";
import { CheckinStyles, FORMAT_LABEL, FREQUENCY_LABEL, Pill, REPORT_PARTS, STATE, T, btn, card, font, formatDate, formatDateTime, hint, label, reportHtml, useCheckinsBase } from "../shared";

const EMPTY = { highs: "", lows: "", resolutions: "" };
const toForm = (report) => ({ highs: reportHtml(report?.highs), lows: reportHtml(report?.lows), resolutions: reportHtml(report?.resolutions) });

// A report's three parts, read-only.
function ReportView({ report }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {REPORT_PARTS.map((part) => (
        <div key={part.key}>
          <p style={{ ...label, marginBottom: 4 }}>{part.label}</p>
          <RichContent html={reportHtml(report?.[part.key])} emptyText="—" />
        </div>
      ))}
    </div>
  );
}

// One check-in: the hub, when, online or in person, who — and its report: highs, lows and
// resolutions. The report can be written from the check-in's day on, by its Account Manager or
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
    if (session && !editing) setForm(toForm(session.report));
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
  const submit = () => {
    const missing = REPORT_PARTS.filter((p) => isEmptyHtml(form[p.key])).map((p) => p.label.toLowerCase());
    if (missing.length) {
      setProblems([`Write the ${missing.join(", ")} — write "None" if there were none.`]);
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
              {reported && <button type="button" className="ci-btn" onClick={() => { setEditing(false); setProblems([]); setForm(toForm(session.report)); }} style={btn("secondary")}>Cancel</button>}
              <button type="button" className="ci-btn" onClick={submit} disabled={save.isPending} style={btn("primary", { disabled: save.isPending })}>
                {!reported && <FiSend size={14} />}{save.isPending ? "Sending…" : reported ? "Save changes" : "Send report"}
              </button>
            </div>
          </div>
        ) : reported ? (
          <ReportView report={session.report} />
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
                <span><strong>{formatDate(r.scheduledDate)}</strong> · {FORMAT_LABEL[r.format]}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.accentMid, fontWeight: 700, fontSize: 12.5 }}>
                  {openEarlier === r.id ? "Hide" : "Show"}
                  <FiChevronDown size={15} style={{ transform: openEarlier === r.id ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
                </span>
              </button>
              {openEarlier === r.id && <div style={{ padding: "0 20px 16px" }}><ReportView report={r.report} /></div>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
