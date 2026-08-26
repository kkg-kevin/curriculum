import { useState } from "react";
import { FiChevronDown, FiChevronUp, FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { DAYS_OF_WEEK, DAY_LABELS } from "../../timetable/schemas/timetable.schema";
import { useTeacherAvailability, useAddAvailabilitySlot, useRemoveAvailabilitySlot } from "../../teachers/hooks/useTeacher";
import WeeklyAvailabilityGrid from "../../teachers/components/WeeklyAvailabilityGrid";

const T = {
  accent: "#25476a", accentMid: "#2e7db5", accentLight: "#38aae1",
  ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const inputStyle = { boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink, outline: "none" };

function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function AddWindowRow({ day, onAdd, onCancel, isSaving }) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const submit = () => {
    if (!startTime || !endTime) return;
    onAdd({ dayOfWeek: day, startTime, endTime }, () => { setStartTime(""); setEndTime(""); });
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
      <span style={{ fontSize: 12.5, color: T.inkFaint }}>to</span>
      <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
      <button
        type="button"
        onClick={submit}
        disabled={!startTime || !endTime || isSaving}
        style={{ padding: "7px 14px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: !startTime || !endTime ? "not-allowed" : "pointer", opacity: !startTime || !endTime ? 0.6 : 1 }}
      >
        Add
      </button>
      <button type="button" onClick={onCancel} style={{ background: "none", border: "none", color: T.inkMuted, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        Cancel
      </button>
    </div>
  );
}

// A teacher's own weekly "here's when I can teach" declaration — one card per weekday, each
// listing that day's declared windows plus an inline "+ Add window" row. Purely additive/opt-in
// (see timetable.service.js's violatesTeacherAvailability): a teacher who never touches this
// page imposes no scheduling restriction at all. Once at least one window exists for ANY day,
// though, a day left with none is treated as "not available that day" — so a teacher who only
// wants to flag a couple of unavailable afternoons, rather than lay out their entire week, should
// still add a window for every day they DO teach.
export default function AvailabilityEditor({ teacherId }) {
  const { data: slots = [], isLoading } = useTeacherAvailability(teacherId);
  const { mutate: addSlot, isPending: adding } = useAddAvailabilitySlot(teacherId);
  const { mutate: removeSlot } = useRemoveAvailabilitySlot(teacherId);
  const [addingDay, setAddingDay] = useState(null);
  // Collapsed by default — the grid above already gives the at-a-glance view, so this list (pure
  // editing surface) only needs to expand when someone actually wants to add/remove a window.
  const [managing, setManaging] = useState(false);

  const slotsByDay = DAYS_OF_WEEK.map((day) => ({
    day,
    windows: slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  if (isLoading) {
    return <div style={{ padding: "40px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading availability…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardStyle, padding: "18px 20px" }}>
        <p style={{ margin: "0 0 14px", fontSize: 13.5, fontWeight: 800, color: T.ink }}>Weekly overview</p>
        <WeeklyAvailabilityGrid slots={slots} />
        {slots.length === 0 && (
          <p style={{ margin: "14px 0 0", fontSize: 12.5, color: T.inkMuted, lineHeight: 1.6 }}>
            You haven't declared any availability yet — your school can schedule you at any time. Add windows below to let them know when you're actually free to teach; once you add at least one, any day left blank is treated as unavailable.
          </p>
        )}
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setManaging((v) => !v)}
          style={{ width: "100%", padding: "14px 18px", border: "none", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiEdit2 size={13} color={T.inkMuted} />
            <span style={{ fontSize: 13.5, fontWeight: 800, color: T.ink }}>Manage windows</span>
            {!managing && <span style={{ fontSize: 11.5, color: T.inkFaint, fontWeight: 500 }}>— add or remove your availability</span>}
          </span>
          {managing ? <FiChevronUp size={16} color={T.inkMuted} /> : <FiChevronDown size={16} color={T.inkMuted} />}
        </button>

        {managing && (
          <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 12, borderTop: `1px solid ${T.border}` }}>
            <div style={{ height: 6 }} />
            {slotsByDay.map(({ day, windows }) => (
        <div key={day} style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>{DAY_LABELS[day]}</p>
            {addingDay !== day && (
              <button
                type="button"
                onClick={() => setAddingDay(day)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", backgroundColor: "#e8f5fb", color: T.accent, border: "1.5px solid #a8d5ee", borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                <FiPlus size={12} /> Add window
              </button>
            )}
          </div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {windows.length === 0 && addingDay !== day && (
              <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint, fontStyle: "italic" }}>No availability declared</p>
            )}
            {windows.map((w) => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{formatTime(w.startTime)} – {formatTime(w.endTime)}</span>
                <button
                  type="button"
                  onClick={() => removeSlot(w.id)}
                  aria-label="Remove window"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "none", border: "none", color: "#DC2626", cursor: "pointer", borderRadius: 8 }}
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
            {addingDay === day && (
              <AddWindowRow
                day={day}
                isSaving={adding}
                onAdd={(data, onDone) => addSlot(data, { onSuccess: () => { onDone(); setAddingDay(null); } })}
                onCancel={() => setAddingDay(null)}
              />
            )}
          </div>
        </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
