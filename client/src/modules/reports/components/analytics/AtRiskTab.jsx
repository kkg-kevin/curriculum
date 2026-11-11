import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiAward, FiCalendar, FiCheck, FiCheckCircle, FiClipboard, FiLogIn, FiMail, FiMessageCircle, FiUsers, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { DataTable, Stat, T, fmtDate, fmtNum, fmtPct } from "./ui";
import { useRecordFollowup } from "../../hooks/useAnalytics";

// Learners at risk (server analytics.risk.js), and following them up (10 Nov 2026 —
// analytics.followups.js): message the parent, tell the class's educators, book a parent check-in
// (admins), or mark them followed up with a note. A learner followed up in the last 30 days shows
// it, and "Hide followed up" keeps the list to who still needs someone.

const FLAG = {
  lowScore: { icon: FiAward, bg: "#FFF5E1", border: "#FDD89A", color: "#7A4F00", tone: "gold" },
  lowAttendance: { icon: FiCalendar, bg: "#EAF6FD", border: "#BFE3F7", color: "#1F6F9E", tone: "sky" },
  missedWork: { icon: FiClipboard, bg: "#E6ECF3", border: "#A9BCD2", color: "#1a3550", tone: "navy" },
  notSignedIn: { icon: FiLogIn, bg: "#EEF0F4", border: "#D5DAE3", color: "#374151", tone: "navy" },
};
const ACTION_LABEL = { parent_message: "Messaged the parent", educator_told: "Told the educators", checkin: "Check-in booked", followed_up: "Followed up" };

function FollowUpDialog({ learner, labelOf, isHub, onClose }) {
  const navigate = useNavigate();
  const record = useRecordFollowup();
  const first = learner.name.split(" ")[0];
  const reasons = learner.flags.map((f) => labelOf[f]);
  const [action, setAction] = useState("parent_message");
  const [message, setMessage] = useState(`Hello, we'd like to check in about ${first}. We've noticed ${reasons.join(", ").toLowerCase()} lately and want to help. Could we talk this week?`);
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const options = [
    { key: "parent_message", icon: FiMail, title: "Message the parent", text: "To their parent login, and by email." },
    { key: "educator_told", icon: FiUsers, title: "Tell the educators", text: "Everyone teaching their class, with the reasons." },
    ...(!isHub ? [{ key: "checkin", icon: FiMessageCircle, title: "Book a parent check-in", text: "Opens a new parent–mentor check-in for their class." }] : []),
    { key: "followed_up", icon: FiCheckCircle, title: "Mark followed up", text: "You called or met them. Add a note." },
  ];

  const submit = () => {
    const body = { learnerId: learner.learnerId, action, reasons, note, message: action === "parent_message" ? message : "" };
    record.mutate(body, {
      onSuccess: (res) => {
        toast.success(action === "parent_message" ? "Message sent to the parent" : action === "educator_told" ? `Told ${res.sentTo} educator${res.sentTo === 1 ? "" : "s"}` : action === "checkin" ? "Noted. Set up the check-in" : "Marked followed up");
        onClose();
        if (action === "checkin") navigate(`/mentor-checkins/rounds/new?hubId=${learner.hubId || ""}&classId=${learner.classId || ""}&learnerId=${learner.learnerId}`);
      },
    });
  };

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(15, 30, 50, 0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div role="dialog" aria-modal="true" aria-label={`Follow up ${learner.name}`} style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.25)", fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "18px 20px 12px", borderBottom: `1px solid ${T.border}` }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.muted }}>Follow up</p>
            <h2 style={{ margin: "2px 0 6px", fontSize: 18, fontWeight: 900, color: T.ink }}>{learner.name}</h2>
            <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {learner.flags.map((f) => <span key={f} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: FLAG[f].bg, border: `1px solid ${FLAG[f].border}`, color: FLAG[f].color }}>{labelOf[f]}</span>)}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><FiX size={16} /></button>
        </div>
        <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            {options.map((o) => (
              <button key={o.key} type="button" onClick={() => setAction(o.key)} aria-pressed={action === o.key}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left", font: "inherit", border: `1.5px solid ${action === o.key ? T.navy : T.border}`, background: action === o.key ? "#F5F8FC" : "#fff" }}>
                <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: action === o.key ? T.navy : "#F3F4F6", color: action === o.key ? "#fff" : T.navy, display: "grid", placeItems: "center", flexShrink: 0 }}><o.icon size={16} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.ink }}>{o.title}</span>
                  <span style={{ display: "block", fontSize: 12, color: T.muted }}>{o.text}</span>
                </span>
                {action === o.key && <FiCheck color={T.navy} />}
              </button>
            ))}
          </div>
          {action === "parent_message" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 700, color: T.muted }}>
              Message
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000}
                style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, font: "inherit", fontSize: 14, fontWeight: 400, color: T.ink, resize: "vertical" }} />
            </label>
          ) : action !== "checkin" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 700, color: T.muted }}>
              {action === "educator_told" ? "Anything to add (optional)" : "Note (optional)"}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000}
                placeholder={action === "followed_up" ? "Called the parent; agreed extra practice at home." : ""}
                style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, font: "inherit", fontSize: 14, fontWeight: 400, color: T.ink, resize: "vertical" }} />
            </label>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 16px", borderRadius: 10, border: `1px solid ${T.border}`, background: "#fff", color: T.ink, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            <button type="button" onClick={submit} disabled={record.isPending || (action === "parent_message" && !message.trim())}
              style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: T.navy, color: "#fff", fontWeight: 800, cursor: "pointer", opacity: record.isPending ? 0.6 : 1 }}>
              {record.isPending ? "Saving…" : action === "parent_message" ? "Send message" : action === "educator_told" ? "Tell them" : action === "checkin" ? "Book a check-in" : "Mark followed up"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function AtRiskTab({ data, links, isHub }) {
  const [only, setOnly] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [following, setFollowing] = useState(null);
  const labelOf = Object.fromEntries(data.flags.map((f) => [f.key, f.label]));
  const rows = data.learners.filter((l) => (!only || l.flags.includes(only)) && (!hideDone || !l.followUp));
  const r = data.rules;
  const ruleText = {
    lowScore: `Marked work under ${r.lowScore.threshold}%`,
    lowAttendance: `Under ${r.lowAttendance.threshold}% attended (${r.lowAttendance.minDays}+ days)`,
    missedWork: `${r.missedWork.threshold}+ pieces past due, not handed in`,
    notSignedIn: `No sign-in by them or a parent for ${r.notSignedIn.days} days`,
  };

  return (
    <>
      <div className="an-stats">
        <Stat icon={FiAlertTriangle} label="Learners at risk" value={fmtNum(data.atRiskCount)} sub={`${fmtPct(data.atRiskPercent)} of ${fmtNum(data.learnerCount)}`} tone="danger" />
        <Stat icon={FiCheckCircle} label="Followed up" value={fmtNum(data.followedUp || 0)} sub={`last ${data.followedUpDays || 30} days`} tone="mid" />
        {data.flags.map((f) => {
          const look = FLAG[f.key];
          return (
            <button key={f.key} type="button" onClick={() => setOnly((x) => (x === f.key ? "" : f.key))} aria-pressed={only === f.key} title={ruleText[f.key]}
              style={{ display: "block", width: "100%", height: "100%", textAlign: "left", padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: 14, outline: only === f.key ? `2px solid ${T.navy}` : "none" }}>
              <Stat icon={look.icon} label={f.label} value={fmtNum(f.count)} tone={look.tone} />
            </button>
          );
        })}
      </div>

      <DataTable
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {only ? `At risk: ${labelOf[only]}` : "Who needs help"}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide followed up
          </label>
        </span>}
        columns={[
          { key: "name", label: "Learner", render: (x) => <button type="button" className="an-link" onClick={() => links.learner(x.learnerId)}>{x.name}</button>, csv: (x) => x.name },
          { key: "className", label: "Class", render: (x) => [x.className, !isHub ? x.hubName : null].filter(Boolean).join(" · ") || "–", csv: (x) => [x.className, x.hubName].filter(Boolean).join(" · ") },
          {
            key: "flags", label: "Why",
            render: (x) => (
              <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {x.flags.map((f) => {
                  const look = FLAG[f];
                  return <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: look.bg, border: `1px solid ${look.border}`, color: look.color, whiteSpace: "nowrap" }}><look.icon size={11} aria-hidden />{labelOf[f]}</span>;
                })}
              </span>
            ),
            csv: (x) => x.flags.map((f) => labelOf[f]).join("; "),
            sort: (x) => x.flags.length,
          },
          { key: "score", label: "Score", align: "num", render: (x) => (x.score == null ? "–" : `${x.score}%`), csv: (x) => x.score },
          { key: "attendanceRate", label: "Attended", align: "num", render: (x) => (x.attendanceRate == null ? "–" : `${x.attendanceRate}%`), csv: (x) => x.attendanceRate },
          { key: "missed", label: "Missed", align: "num" },
          { key: "lastSignIn", label: "Last sign-in", render: (x) => (!x.hasLogin ? "No login" : x.lastSignIn ? fmtDate(x.lastSignIn) : "Never"), csv: (x) => x.lastSignIn || (x.hasLogin ? "never" : "no login"), sort: (x) => (x.lastSignIn ? new Date(x.lastSignIn).getTime() : 0) },
          {
            key: "followUp", label: "Follow-up",
            render: (x) => (
              <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                {x.followUp && (
                  <span title={[x.followUp.note, x.followUp.by && `by ${x.followUp.by}`].filter(Boolean).join(" · ")} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: T.navy, background: "#EAF6FD", border: "1px solid #BFE3F7", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
                    <FiCheck size={11} aria-hidden /> {ACTION_LABEL[x.followUp.action] || "Followed up"} · {fmtDate(x.followUp.at)}
                  </span>
                )}
                <button type="button" onClick={() => setFollowing(x)}
                  style={{ padding: "5px 11px", borderRadius: 8, border: `1px solid ${x.followUp ? T.border : T.navy}`, background: x.followUp ? "#fff" : T.navy, color: x.followUp ? T.navy : "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {x.followUp ? "Again" : "Follow up"}
                </button>
              </span>
            ),
            csv: (x) => (x.followUp ? `${ACTION_LABEL[x.followUp.action]} ${String(x.followUp.at).slice(0, 10)}` : ""),
            sort: (x) => (x.followUp ? new Date(x.followUp.at).getTime() : 0),
          },
        ]}
        rows={rows}
        filename="learners-at-risk.csv"
        initialSort={{ key: "flags", dir: "desc" }}
        limit={25}
        empty={hideDone ? "Everyone at risk has been followed up." : "No learner matches these reasons in this period."}
      />
      {following && <FollowUpDialog learner={following} labelOf={labelOf} isHub={isHub} onClose={() => setFollowing(null)} />}
    </>
  );
}
