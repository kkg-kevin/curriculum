import { useMemo, useState } from "react";
import { useFreeTimes, useMentorMutation } from "../hooks/useMentorCheckins";
import { mentorCheckinsApi } from "../services/mentorCheckinsApi";
import { Modal, T, btn, chip, hint, shortDay } from "../shared";

// Picks another time for a check-in from its round's free times — never one another family has or
// the educators are busy at (the server's list, checked again on save). A parent's start tomorrow;
// our team's today. `asParent` words it for the parent.
export default function TimePickerDialog({ meeting, asParent = false, onClose }) {
  const { data: times = [], isLoading, isError, error } = useFreeTimes(meeting.id);
  const [chosen, setChosen] = useState(null);
  const [problem, setProblem] = useState("");
  const save = useMentorMutation(
    (t) => mentorCheckinsApi.changeTime(meeting.id, { date: t.date, startTime: t.startTime }),
    asParent ? "Your new time is booked" : "Check-in moved — the family has been told",
    { toastErrors: false },
  );
  const byDay = useMemo(() => {
    const map = new Map();
    for (const t of times) (map.get(t.date) || map.set(t.date, []).get(t.date)).push(t);
    return [...map.entries()];
  }, [times]);

  const submit = () => {
    if (!chosen) return;
    setProblem("");
    save.mutate(chosen, { onSuccess: onClose, onError: (err) => setProblem(err?.message || "That time couldn't be booked — pick another") });
  };

  return (
    <Modal
      title={asParent ? "Pick another time" : "Move this check-in"}
      onClose={onClose}
      width={620}
      footer={<>
        <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" onClick={submit} disabled={!chosen || save.isPending} style={btn("primary", { disabled: !chosen || save.isPending })}>
          {save.isPending ? "Booking…" : chosen ? `Book ${shortDay(chosen.date)}, ${chosen.startTime}` : "Choose a time"}
        </button>
      </>}
    >
      <p style={{ ...hint, fontSize: 13, marginTop: 0 }}>
        Now: <strong style={{ color: T.ink }}>{shortDay(meeting.date)}, {meeting.startTime}–{meeting.endTime}</strong>.{" "}
        {asParent ? "These are the times still free — the mentor is told of your new time." : "These are the round's times still free. The family is told and asked to confirm again."}
      </p>
      {isLoading && <p style={hint}>Finding free times…</p>}
      {isError && <p style={{ ...hint, color: "#B91C1C" }}>{error?.message || "The free times couldn't be loaded."}</p>}
      {!isLoading && !isError && !times.length && (
        <p style={{ ...hint, fontSize: 13 }}>{asParent ? "There are no other free times left. If you can't make yours, get in touch with the hub." : "No other free times are left in this round's window."}</p>
      )}
      <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
        {byDay.map(([date, list]) => (
          <div key={date}>
            <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 800, color: "#374151" }}>{shortDay(date)}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {list.map((t) => {
                const on = chosen?.date === t.date && chosen?.startTime === t.startTime;
                return (
                  <button key={t.startTime} type="button" aria-pressed={on} onClick={() => setChosen(t)} style={chip(on)}>{t.startTime}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {problem && <p style={{ margin: "12px 0 0", color: "#B91C1C", fontSize: 12.5 }}>{problem}</p>}
    </Modal>
  );
}
