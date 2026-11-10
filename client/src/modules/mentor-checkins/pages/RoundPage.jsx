import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiClock, FiEdit2, FiMapPin, FiMove, FiSlash, FiVideo, FiXCircle } from "react-icons/fi";
import { useMentorMutation, useRound } from "../hooks/useMentorCheckins";
import { mentorCheckinsApi } from "../services/mentorCheckinsApi";
import TimePickerDialog from "../components/TimePickerDialog";
import { CheckinStyles, FORMAT_LABEL, Modal, Pill, T, btn, card, childNames, font, formatDate, hint, input, label, safeMeetingLink, shortDay, stateFor, useMentorBase } from "../shared";

const WEEKDAY_SHORT = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

// Changing the link (online) or the place (in person) after publishing.
function WhereDialog({ round, onClose }) {
  const online = round.format === "online";
  const [value, setValue] = useState(online ? round.meetingLink || "" : round.location || "");
  const [problem, setProblem] = useState("");
  const save = useMentorMutation((body) => mentorCheckinsApi.updateRound(round.id, body), "Saved", { toastErrors: false });
  return (
    <Modal
      title={online ? "Link to join" : "Where"}
      onClose={onClose}
      footer={<>
        <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" disabled={save.isPending} onClick={() => save.mutate(online ? { meetingLink: value.trim() || null } : { location: value.trim() || null }, { onSuccess: onClose, onError: (e) => setProblem(e?.message || "Couldn't save") })} style={btn("primary", { disabled: save.isPending })}>Save</button>
      </>}
    >
      <label htmlFor="mc-where" style={label}>{online ? "The meeting link" : "The place"}</label>
      <input id="mc-where" value={value} onChange={(e) => setValue(e.target.value)} style={input} maxLength={online ? 500 : 255} placeholder={online ? "https://meet.google.com/abc-defg-hij" : "e.g. The hub's front office"} />
      <p style={hint}>Reminders from now on, and every check-in page, show the new {online ? "link" : "place"}.</p>
      {problem && <p style={{ margin: "8px 0 0", color: "#B91C1C", fontSize: 12.5 }}>{problem}</p>}
    </Modal>
  );
}

// One class's round of parent check-ins: the schedule, family by family, and where each stands.
// Managers move a family's time, cancel one check-in or the whole round, and change the link or
// place. Educators, the hub and supervisors read it.
export default function RoundPage() {
  const { id } = useParams();
  const base = useMentorBase();
  const { data: round, isLoading, isError, error } = useRound(id);
  const [moving, setMoving] = useState(null);
  const [whereOpen, setWhereOpen] = useState(false);
  const cancelRound = useMentorMutation(() => mentorCheckinsApi.cancelRound(id), "Check-ins cancelled — the families and educators have been told");
  const cancelOne = useMentorMutation((meetingId) => mentorCheckinsApi.cancelMeeting(meetingId), "Check-in cancelled — the family has been told");

  if (isLoading) return <p style={{ ...hint, fontFamily: font }}>Loading…</p>;
  if (isError || !round) {
    return (
      <div style={{ fontFamily: font }}>
        <Link to={base} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none" }}><FiArrowLeft size={14} /> Back</Link>
        <p style={{ marginTop: 14, color: "#B91C1C", fontSize: 14 }}>{error?.message || "These check-ins couldn't be found."}</p>
      </div>
    );
  }
  const { permissions: can } = round;
  const c = round.counts;
  const viewer = base === "/mentor-checkins" ? "manager" : "staff";
  const link = safeMeetingLink(round.meetingLink);

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16, width: "100%", minWidth: 0 }}>
      <CheckinStyles />
      <Link to={base === "/mentor-checkins" ? base : `${base}?tab=classes`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> Parent–Mentor Check-ins</Link>

      <section style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: T.ink }}>{round.className}</h1>
              <span style={{ fontSize: 14, color: T.inkMuted }}>{round.hubName}</span>
              {round.status === "cancelled" && <Pill look={{ bg: "#FEF2F2", color: "#B91C1C" }}>Cancelled</Pill>}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 13, color: T.inkMuted }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiCalendar size={13} /> {formatDate(round.windowStart, { day: "numeric", month: "short" })} – {formatDate(round.windowEnd, { day: "numeric", month: "short", year: "numeric" })}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiClock size={13} /> {round.days.map((d) => WEEKDAY_SHORT[d]).join(", ")} · {round.dayStart}–{round.dayEnd} · {round.minutes} min each</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{round.format === "online" ? <FiVideo size={13} /> : <FiMapPin size={13} />}{round.format === "online" ? (link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: T.accentMid }}>{FORMAT_LABEL.online}</a> : FORMAT_LABEL.online) : round.location || FORMAT_LABEL.in_person}</span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#374151" }}><strong>Educators:</strong> {round.educatorNames.join(", ") || "—"}{round.templateName ? <> · <strong>Template:</strong> {round.templateName}</> : null}</p>
            {round.createdByName && <p style={{ ...hint, marginTop: 4 }}>Set up by {round.createdByName}</p>}
          </div>
          {can.canCancel && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="ci-btn" onClick={() => setWhereOpen(true)} style={btn("secondary", { size: "sm" })}><FiEdit2 size={13} /> {round.format === "online" ? "Change link" : "Change place"}</button>
              <button
                type="button" className="ci-btn" disabled={cancelRound.isPending}
                onClick={() => { if (window.confirm(`Cancel the check-ins still to come for ${round.className}? Every family and educator is told. Reports already written stay.`)) cancelRound.mutate(); }}
                style={btn("danger", { size: "sm", disabled: cancelRound.isPending })}
              >
                <FiSlash size={13} /> Cancel all
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
          <Pill look={{ bg: "#EFF6FF", color: "#1D4ED8" }}>{c.total} famil{c.total === 1 ? "y" : "ies"}</Pill>
          <Pill look={{ bg: "#F0F9FF", color: "#075985" }}>{c.upcoming} coming · {c.confirmed} confirmed</Pill>
          <Pill look={{ bg: "#FFFBEB", color: "#B45309" }}>{c.reportDue} report{c.reportDue === 1 ? "" : "s"} due</Pill>
          <Pill look={{ bg: "#F5F3FF", color: "#6D28D9" }}>{c.awaitingApproval} with parents</Pill>
          <Pill look={{ bg: "#ECFDF5", color: "#047857" }}>{c.approved} approved</Pill>
          {c.missed > 0 && <Pill look={{ bg: "#FEF2F2", color: "#B91C1C" }}>{c.missed} missed</Pill>}
          {c.cancelled > 0 && <Pill look={{ bg: "#F3F4F6", color: "#6B7280" }}>{c.cancelled} cancelled</Pill>}
        </div>
      </section>

      <section style={{ ...card, overflow: "hidden" }}>
        <h2 style={{ margin: 0, padding: "16px 20px 8px", fontSize: 15, fontWeight: 800, color: T.ink }}>Schedule</h2>
        {round.meetings.map((m) => {
          const live = ["upcoming", "today"].includes(m.state);
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", borderTop: "1px solid #F3F4F6", flexWrap: "wrap" }}>
              <div style={{ width: 120, flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.ink }}>{shortDay(m.date)}</p>
                <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted }}>{m.startTime}–{m.endTime}</p>
              </div>
              <Link to={`${base}/meetings/${m.id}`} style={{ flex: "1 1 220px", minWidth: 0, textDecoration: "none" }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{childNames(m)}</p>
                <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>{m.parentName}</p>
              </Link>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <Pill look={stateFor(m.state, viewer)} />
                {live && (m.confirmed
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#047857" }}><FiCheckCircle size={12} /> Confirmed{m.parentChangedAt ? " (their pick)" : ""}</span>
                  : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: T.inkMuted }}><FiXCircle size={12} /> Not confirmed yet</span>)}
                {m.score != null && <Pill look={{ bg: "#F5F3FF", color: "#6D28D9" }}>{m.score}%</Pill>}
              </div>
              {can.canManage && live && (
                <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  <button type="button" className="ci-btn" onClick={() => setMoving(m)} style={btn("secondary", { size: "sm" })}><FiMove size={13} /> Move</button>
                  <button type="button" className="ci-btn" disabled={cancelOne.isPending} onClick={() => { if (window.confirm(`Cancel the check-in with ${m.parentName}? They're told.`)) cancelOne.mutate(m.id); }} style={btn("danger", { size: "sm", disabled: cancelOne.isPending })}>Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </section>
      {moving && <TimePickerDialog meeting={moving} onClose={() => setMoving(null)} />}
      {whereOpen && <WhereDialog round={round} onClose={() => setWhereOpen(false)} />}
    </div>
  );
}
