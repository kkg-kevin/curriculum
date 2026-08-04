import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

const T = {
  accent: "#25476a", accentMid: "#2e7db5", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

const EVENT_COLORS = [
  { bg: "#EDE9FE", border: "#C4B5FD", text: "#5B21B6" },
  { bg: "#DBEAFE", border: "#93C5FD", text: "#1D4ED8" },
  { bg: "#D1FAE5", border: "#6EE7B7", text: "#047857" },
  { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" },
  { bg: "#FCE7F3", border: "#F9A8D4", text: "#9D174D" },
  { bg: "#E0F2FE", border: "#7DD3FC", text: "#075985" },
];
function colorForCourse(courseId) {
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) hash = (hash * 31 + courseId.charCodeAt(i)) >>> 0;
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function formatTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
// This app's timetable only ever schedules Monday-Friday (see DAYS_OF_WEEK in
// timetable.schema.js) — the calendar deliberately shows 5 weekday columns, not a full 7-day
// week, since Sat/Sun can never carry an event.
function startOfWeekMonday(d) {
  const day = d.day();
  return d.subtract(day === 0 ? 6 : day - 1, "day").startOf("day");
}
function weekDays(anchor) {
  const start = startOfWeekMonday(anchor);
  return [0, 1, 2, 3, 4].map((i) => start.add(i, "day"));
}
function monthGrid(anchor) {
  const monthStart = anchor.startOf("month");
  const monthEnd = anchor.endOf("month");
  const lastWeekStart = startOfWeekMonday(monthEnd);
  const weeks = [];
  let weekStart = startOfWeekMonday(monthStart);
  while (weekStart.isBefore(lastWeekStart) || weekStart.isSame(lastWeekStart, "day")) {
    weeks.push([0, 1, 2, 3, 4].map((i) => weekStart.add(i, "day")));
    weekStart = weekStart.add(7, "day");
  }
  return weeks;
}

const DEFAULT_START_MIN = 7 * 60;
const DEFAULT_END_MIN = 18 * 60;
const HOUR_PX = 52;

/**
 * Shared week/month calendar grid for the timetable feature. Presentational only — the parent
 * page owns fetching (see `useClassCalendar`/`useMyTeacherCalendar`/`useMyLearnerCalendar`) and
 * drives it off `onRangeChange`, which fires on mount and whenever navigation changes the visible
 * date range.
 */
export default function CalendarView({ events, isLoading, resolveCourseName, resolveTeacherLabel, onRangeChange, emptyMessage }) {
  const [anchor, setAnchor] = useState(() => dayjs());
  const [mode, setMode] = useState("week");

  const range = useMemo(() => {
    if (mode === "month") {
      const grid = monthGrid(anchor);
      return { from: grid[0][0].format("YYYY-MM-DD"), to: grid[grid.length - 1][4].format("YYYY-MM-DD") };
    }
    const days = weekDays(anchor);
    return { from: days[0].format("YYYY-MM-DD"), to: days[4].format("YYYY-MM-DD") };
  }, [anchor, mode]);

  useEffect(() => {
    onRangeChange?.(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const e of events || []) {
      (map[e.date] = map[e.date] || []).push(e);
    }
    for (const date in map) map[date].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [events]);

  const navigate = (dir) => setAnchor((a) => a.add(dir, mode === "month" ? "month" : "week"));
  const goToday = () => setAnchor(dayjs());

  const rangeLabel = mode === "month"
    ? anchor.format("MMMM YYYY")
    : (() => {
        const days = weekDays(anchor);
        return `${days[0].format("D MMM")} - ${days[4].format("D MMM YYYY")}`;
      })();

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...cardStyle, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={goToday} style={btnStyle(false)}>Today</button>
          <button type="button" onClick={() => navigate(-1)} aria-label="Previous" style={{ ...btnStyle(false), padding: "6px 10px" }}>←</button>
          <button type="button" onClick={() => navigate(1)} aria-label="Next" style={{ ...btnStyle(false), padding: "6px 10px" }}>→</button>
          <span style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginLeft: 4 }}>{rangeLabel}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setMode("week")} style={btnStyle(mode === "week")}>Week</button>
          <button type="button" onClick={() => setMode("month")} style={btnStyle(mode === "month")}>Month</button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading calendar…</div>
      ) : mode === "week" ? (
        <WeekGrid days={weekDays(anchor)} eventsByDate={eventsByDate} resolveCourseName={resolveCourseName} resolveTeacherLabel={resolveTeacherLabel} emptyMessage={emptyMessage} />
      ) : (
        <MonthGrid weeks={monthGrid(anchor)} anchor={anchor} eventsByDate={eventsByDate} resolveCourseName={resolveCourseName} emptyMessage={emptyMessage} />
      )}
    </div>
  );
}

function btnStyle(active) {
  return {
    padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
    border: `1.5px solid ${active ? T.accent : T.border}`, backgroundColor: active ? T.accent : "#fff", color: active ? "#fff" : T.inkMuted,
  };
}

function WeekGrid({ days, eventsByDate, resolveCourseName, resolveTeacherLabel, emptyMessage }) {
  const allEvents = days.flatMap((d) => eventsByDate[d.format("YYYY-MM-DD")] || []);
  const gridStartMin = Math.min(DEFAULT_START_MIN, ...allEvents.map((e) => toMinutes(e.startTime)));
  const gridEndMin = Math.max(DEFAULT_END_MIN, ...allEvents.map((e) => toMinutes(e.endTime)));
  const gridStartHour = Math.floor(gridStartMin / 60);
  const gridEndHour = Math.ceil(gridEndMin / 60);
  const hours = [];
  for (let h = gridStartHour; h < gridEndHour; h++) hours.push(h);
  const gridHeight = hours.length * HOUR_PX;
  const totalMinutes = hours.length * 60;

  const top = (time) => ((toMinutes(time) - gridStartHour * 60) / totalMinutes) * gridHeight;
  const height = (start, end) => Math.max(((toMinutes(end) - toMinutes(start)) / totalMinutes) * gridHeight, 22);

  if (allEvents.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "50px 24px" }}>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>{emptyMessage || "Nothing scheduled this week."}</p>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(5, 1fr)", borderBottom: `1px solid ${T.border}` }}>
        <div />
        {days.map((d) => (
          <div key={d.format("YYYY-MM-DD")} style={{ padding: "10px 8px", textAlign: "center", borderLeft: `1px solid ${T.border}` }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase" }}>{d.format("ddd")}</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: d.isSame(dayjs(), "day") ? T.accent : T.ink }}>{d.format("D")}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(5, 1fr)", position: "relative" }}>
        <div>
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_PX, borderTop: `1px solid ${T.border}`, fontSize: 10.5, color: T.inkFaint, padding: "2px 6px", boxSizing: "border-box" }}>
              {dayjs().hour(h).minute(0).format("h A")}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dateKey = d.format("YYYY-MM-DD");
          const dayEvents = eventsByDate[dateKey] || [];
          return (
            <div key={dateKey} style={{ position: "relative", borderLeft: `1px solid ${T.border}`, height: gridHeight }}>
              {hours.map((h) => (
                <div key={h} style={{ position: "absolute", top: (h - gridStartHour) * HOUR_PX, left: 0, right: 0, height: 0, borderTop: `1px solid ${T.border}` }} />
              ))}
              {dayEvents.map((e) => {
                const color = colorForCourse(e.courseId);
                return (
                  <div
                    key={`${e.courseId}-${e.sessionId}-${e.startTime}`}
                    title={`${resolveCourseName(e.courseId)} · Session ${e.sessionOrder}: ${e.sessionTitle}`}
                    style={{
                      position: "absolute", top: top(e.startTime), height: height(e.startTime, e.endTime), left: 4, right: 4,
                      backgroundColor: color.bg, border: `1px solid ${color.border}`, borderRadius: 8, padding: "4px 6px", overflow: "hidden", boxSizing: "border-box",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: color.text }}>{formatTime(e.startTime)} – {formatTime(e.endTime)}</p>
                    <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{resolveCourseName(e.courseId)}</p>
                    <p style={{ margin: 0, fontSize: 10, color: color.text, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Session {e.sessionOrder}: {e.sessionTitle}
                    </p>
                    {resolveTeacherLabel && (
                      <p style={{ margin: 0, fontSize: 9.5, color: color.text, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {resolveTeacherLabel(e)}{e.room ? ` · ${e.room}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ weeks, anchor, eventsByDate, resolveCourseName, emptyMessage }) {
  const hasAny = weeks.some((w) => w.some((d) => (eventsByDate[d.format("YYYY-MM-DD")] || []).length > 0));
  if (!hasAny) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "50px 24px" }}>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>{emptyMessage || "Nothing scheduled this month."}</p>
      </div>
    );
  }
  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: `1px solid ${T.border}` }}>
        {weeks[0].map((d) => (
          <div key={d.format("ddd")} style={{ padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase" }}>
            {d.format("ddd")}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: wi < weeks.length - 1 ? `1px solid ${T.border}` : "none" }}>
          {week.map((d) => {
            const dateKey = d.format("YYYY-MM-DD");
            const dayEvents = eventsByDate[dateKey] || [];
            const inMonth = d.month() === anchor.month();
            const visible = dayEvents.slice(0, 3);
            const overflow = dayEvents.length - visible.length;
            return (
              <div key={dateKey} style={{ minHeight: 92, padding: "6px 6px", borderLeft: `1px solid ${T.border}`, opacity: inMonth ? 1 : 0.4 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 800, color: d.isSame(dayjs(), "day") ? T.accent : T.ink }}>{d.format("D")}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {visible.map((e) => {
                    const color = colorForCourse(e.courseId);
                    return (
                      <div
                        key={`${e.courseId}-${e.sessionId}`}
                        title={`${resolveCourseName(e.courseId)} · Session ${e.sessionOrder}: ${e.sessionTitle}`}
                        style={{ backgroundColor: color.bg, border: `1px solid ${color.border}`, borderRadius: 5, padding: "2px 5px", fontSize: 9.5, fontWeight: 700, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {resolveCourseName(e.courseId)}
                      </div>
                    );
                  })}
                  {overflow > 0 && <p style={{ margin: 0, fontSize: 9.5, color: T.inkFaint }}>+{overflow} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
