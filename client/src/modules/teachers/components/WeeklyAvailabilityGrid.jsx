import { DAYS_OF_WEEK, DAY_LABELS } from "../../timetable/schemas/timetable.schema";

const T = {
  accent: "#25476a", accentMid: "#2e7db5", accentLight: "#38aae1",
  ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};

function toMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

function formatTime(minutesOfDay) {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? ":" + String(m).padStart(2, "0") : ""} ${period}`;
}

function formatWindow(startTime, endTime) {
  return `${formatTime(toMinutes(startTime))} – ${formatTime(toMinutes(endTime))}`;
}

const AXIS_START_DEFAULT = 7 * 60; // 07:00 — covers ordinary school hours; widened below if a
const AXIS_END_DEFAULT = 18 * 60; // 18:00 — declared window genuinely falls outside this range.
const HOUR_HEIGHT = 40; // px per hour row in the grid

// A Calendly/Google-Calendar-style weekly grid — colored blocks positioned by time-of-day within
// each weekday column, so "when is this teacher free" reads at a glance instead of requiring
// someone to parse a list of HH:MM strings per day. Read-only: this is the *display*, not the
// editor — AvailabilityEditor.jsx renders this above its own add/remove list, and TeacherViewPage
// (admin/school) renders it standalone, since that side previously had no visibility into a
// teacher's declared availability at all despite scheduling around it.
export default function WeeklyAvailabilityGrid({ slots = [] }) {
  const bounds = slots.reduce(
    (acc, s) => ({ start: Math.min(acc.start, toMinutes(s.startTime)), end: Math.max(acc.end, toMinutes(s.endTime)) }),
    { start: AXIS_START_DEFAULT, end: AXIS_END_DEFAULT }
  );
  const axisStart = Math.floor(bounds.start / 60) * 60;
  const axisEnd = Math.ceil(bounds.end / 60) * 60;
  const totalMinutes = axisEnd - axisStart;
  const gridHeight = (totalMinutes / 60) * HOUR_HEIGHT;
  const hourMarks = [];
  for (let m = axisStart; m <= axisEnd; m += 60) hourMarks.push(m);

  const slotsByDay = DAYS_OF_WEEK.map((day) => ({
    day,
    windows: slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  const totalWeeklyMinutes = slots.reduce((sum, s) => sum + (toMinutes(s.endTime) - toMinutes(s.startTime)), 0);
  const daysCovered = new Set(slots.map((s) => s.dayOfWeek)).size;
  const weeklyHours = Math.floor(totalWeeklyMinutes / 60);
  const weeklyMinutesRemainder = totalWeeklyMinutes % 60;

  if (slots.length === 0) {
    return (
      <div style={{ padding: "36px 20px", textAlign: "center", border: `1.5px dashed ${T.border}`, borderRadius: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.inkMuted }}>No availability declared</p>
        <p style={{ margin: "5px 0 0", fontSize: 12, color: T.inkFaint }}>This teacher can be scheduled at any time.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 22, marginBottom: 16, flexWrap: "wrap" }}>
        <SummaryStat label="Hours / week" value={`${weeklyHours}h${weeklyMinutesRemainder ? ` ${weeklyMinutesRemainder}m` : ""}`} />
        <SummaryStat label="Days available" value={`${daysCovered} of 5`} />
        <SummaryStat label="Windows" value={slots.length} />
      </div>

      <div style={{ display: "flex", border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ width: 54, flexShrink: 0, borderRight: `1px solid ${T.border}`, backgroundColor: "#FAFBFC" }}>
          <div style={{ height: 30, borderBottom: `1px solid ${T.border}` }} />
          <div style={{ position: "relative", height: gridHeight }}>
            {hourMarks.map((m) => (
              <div key={m} style={{ position: "absolute", top: `calc(${((m - axisStart) / totalMinutes) * 100}% - 6px)`, right: 7, fontSize: 10, color: T.inkFaint, fontWeight: 700, whiteSpace: "nowrap" }}>
                {formatTime(m)}
              </div>
            ))}
          </div>
        </div>

        {slotsByDay.map(({ day, windows }, i) => (
          <div key={day} style={{ flex: 1, minWidth: 0, borderRight: i < DAYS_OF_WEEK.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${T.border}`, backgroundColor: windows.length ? "#F1F9FD" : "#FAFBFC" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: windows.length ? T.accent : T.inkFaint, textTransform: "uppercase", letterSpacing: ".04em" }}>
                {DAY_LABELS[day].slice(0, 3)}
              </span>
            </div>
            <div style={{ position: "relative", height: gridHeight, backgroundColor: "#fff" }}>
              {hourMarks.map((m) => (
                <div key={m} style={{ position: "absolute", top: `${((m - axisStart) / totalMinutes) * 100}%`, left: 0, right: 0, borderTop: "1px solid #F3F4F6" }} />
              ))}
              {windows.map((w) => {
                const top = ((toMinutes(w.startTime) - axisStart) / totalMinutes) * 100;
                const height = Math.max(6, ((toMinutes(w.endTime) - toMinutes(w.startTime)) / totalMinutes) * 100);
                const tall = (height / 100) * gridHeight > 34;
                return (
                  <div
                    key={w.id}
                    title={formatWindow(w.startTime, w.endTime)}
                    style={{
                      position: "absolute", top: `${top}%`, height: `${height}%`, left: 4, right: 4,
                      background: `linear-gradient(160deg, ${T.accentLight} 0%, ${T.accentMid} 100%)`,
                      borderRadius: 7, padding: "3px 6px", overflow: "hidden",
                      boxShadow: "0 2px 6px rgba(46,125,181,0.32)",
                    }}
                  >
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", lineHeight: 1.25 }}>{formatTime(toMinutes(w.startTime))}</div>
                    {tall && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.88)", lineHeight: 1.25 }}>{formatTime(toMinutes(w.endTime))}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 19, fontWeight: 850, color: T.accent, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
