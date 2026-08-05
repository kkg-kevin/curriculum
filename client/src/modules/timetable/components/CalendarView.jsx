import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { useSessionSummary, useSessionStatusBulk } from "../hooks/useTimetable";

const T = {
  accent: "#25476a", accentMid: "#2e7db5", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
  breakBg: "#FEF2F2", breakBorder: "#FCA5A5", breakText: "#B91C1C",
};

// One shared read on "is this number good, needs watching, or needs attention" — used for both
// the small status dot on a calendar card and the coloring of stat tiles in the hover/detail
// views, so the same underlying numbers always read the same color everywhere they show up.
const HEALTH = {
  good:      { text: "#047857", bg: "#D1FAE5", border: "#6EE7B7", dot: "#10B981" },
  warning:   { text: "#92400E", bg: "#FEF3C7", border: "#FCD34D", dot: "#F59E0B" },
  attention: { text: "#B91C1C", bg: "#FEE2E2", border: "#FCA5A5", dot: "#EF4444" },
  neutral:   { text: T.inkMuted, bg: "#F3F4F6", border: T.border, dot: "#D1D5DB" },
};

// Future sessions get "neutral" — attendance/grading isn't expected yet, so there's nothing to
// judge. Past/today sessions: unmarked attendance or very low turnout is worth flagging outright;
// an assessment still being graded is a lesser "in progress" state, not a problem by itself.
function sessionHealth({ isFuture, attendanceMarked, attendancePercent, gradingRequired, gradingComplete }) {
  if (isFuture) return "neutral";
  if (!attendanceMarked) return "attention";
  if (attendancePercent !== null && attendancePercent < 50) return "attention";
  if (gradingRequired && !gradingComplete) return "warning";
  return "good";
}

// A stable identity for one calendar occurrence — course+session alone isn't unique enough for a
// merged teacher/learner view, where the same course can run in more than one of their classes
// and land the same session on the same date in both.
function eventKey(e) {
  return `${e.classId}-${e.courseId}-${e.sessionId}-${e.date}-${e.startTime}`;
}
// Matches the server's own bulk-status map key exactly (see getSessionStatusBulk in
// timetable.service.js) — deliberately without startTime, since a (class, session, date) triple
// is already a unique calendar occurrence on its own.
function statusKey(e) {
  return `${e.classId}-${e.sessionId}-${e.date}`;
}

function StatusDot({ health, title }) {
  const c = HEALTH[health] || HEALTH.neutral;
  return (
    <span
      title={title}
      style={{
        position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: "50%",
        backgroundColor: c.dot, border: "1.5px solid #fff", boxShadow: `0 0 0 1px ${c.dot}66`,
      }}
    />
  );
}

function ProgressBar({ percent, color }) {
  const pct = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div style={{ height: 5, borderRadius: 3, backgroundColor: "#EEF1F5", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: 3, transition: "width 0.3s ease" }} />
    </div>
  );
}

function IconAttendance({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="2" />
      <path d="M3.3 20c0-3.3 2.6-5.7 5.7-5.7s5.7 2.4 5.7 5.7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="9" r="2.3" stroke={color} strokeWidth="1.8" />
      <path d="M14.8 20c.3-2.5 2-4.1 4.1-4.1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconGrading({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke={color} strokeWidth="2" />
      <path d="M9 12l2.2 2.2L15.5 9.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconScore({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
// Break dates are plain "YYYY-MM-DD" strings, so lexical comparison already matches chronological
// order — no date parsing needed here.
function breakOnDate(dateStr, breaks) {
  return (breaks || []).find((b) => dateStr >= b.start && dateStr <= b.end) || null;
}

// A break is a property of one whole curriculum/program — every class within it shares the same
// dates — but a merged teacher/learner calendar can span several different curricula at once,
// each on its own independent calendar (see resolveTeacherCalendar/resolveLearnerCalendar in
// timetable.service.js). Without naming which class(es) a given break actually belongs to, it
// reads as if it applies to every class shown that day — including ones on an unrelated
// curriculum whose sessions are correctly still running. resolveClassLabel is optional: the
// single-class school-portal view doesn't need this disambiguation, so its breaks render
// unqualified same as before.
function breakLabel(brk, resolveClassLabel) {
  if (!resolveClassLabel || !brk.classIds?.length) return brk.label;
  const names = [...new Set(brk.classIds.map((id) => resolveClassLabel(id)).filter(Boolean))];
  return names.length ? `${brk.label} — ${names.join(", ")}` : brk.label;
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
 * Shared week/month calendar grid for the timetable feature. Presentational only for the range
 * itself — the parent page owns fetching the calendar's events/breaks (see
 * `useClassCalendar`/`useMyTeacherCalendar`/`useMyLearnerCalendar`) and drives it off
 * `onRangeChange`, which fires on mount and whenever navigation changes the visible date range.
 *
 * enableSessionDetail is the one deliberate exception to "presentational only": when true, this
 * component owns its own on-demand fetch (via useSessionSummary) for whichever single session is
 * currently hovered/clicked. That's session-scoped, not range-scoped — pulling it up into every
 * parent page would mean duplicating hover-timing/positioning logic in three places for no
 * benefit, and it can't accidentally affect the range data flowing in via props. Defaults to
 * false so every existing caller (in particular learner-portal, which shouldn't expose
 * classmates' attendance/scores) is completely unaffected unless it opts in.
 */
export default function CalendarView({ events, breaks, isLoading, resolveCourseName, resolveTeacherLabel, resolveClassLabel, onRangeChange, emptyMessage, enableSessionDetail = false }) {
  const [anchor, setAnchor] = useState(() => dayjs());
  const [mode, setMode] = useState("week");
  const [activeEvent, setActiveEvent] = useState(null);

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

  // One batched status lookup for every occurrence currently on screen, powering the small
  // health dot on each card — see the enableSessionDetail doc comment for why this (like the
  // hover/click detail) is fetched here rather than pushed up to the parent page.
  const occurrences = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const e of events || []) {
      const k = statusKey(e);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push({ classId: e.classId, sessionId: e.sessionId, date: e.date });
    }
    return list;
  }, [events]);
  const { data: statusByKey = {} } = useSessionStatusBulk(occurrences, enableSessionDetail);

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
      <style>{`
        @keyframes cv-fadein { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cv-modal-in { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
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
        <WeekGrid
          days={weekDays(anchor)} eventsByDate={eventsByDate} breaks={breaks}
          resolveCourseName={resolveCourseName} resolveTeacherLabel={resolveTeacherLabel} resolveClassLabel={resolveClassLabel}
          emptyMessage={emptyMessage} enableSessionDetail={enableSessionDetail} onOpenDetail={setActiveEvent} statusByKey={statusByKey}
        />
      ) : (
        <MonthGrid
          weeks={monthGrid(anchor)} anchor={anchor} eventsByDate={eventsByDate} breaks={breaks}
          resolveCourseName={resolveCourseName} resolveClassLabel={resolveClassLabel}
          emptyMessage={emptyMessage} enableSessionDetail={enableSessionDetail} onOpenDetail={setActiveEvent} statusByKey={statusByKey}
        />
      )}

      {enableSessionDetail && activeEvent && (
        <SessionDetailModal event={activeEvent} resolveCourseName={resolveCourseName} onClose={() => setActiveEvent(null)} />
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

function WeekGrid({ days, eventsByDate, breaks, resolveCourseName, resolveTeacherLabel, resolveClassLabel, emptyMessage, enableSessionDetail, onOpenDetail, statusByKey }) {
  const today = dayjs();
  const allEvents = days.flatMap((d) => eventsByDate[d.format("YYYY-MM-DD")] || []);
  const anyBreakInView = days.some((d) => breakOnDate(d.format("YYYY-MM-DD"), breaks));

  // One shared hover-preview slot for the whole grid, rather than per-card state — only ever one
  // card can be hovered at a time, so this keeps it to a single debounce timer and a single
  // useSessionSummary fetch no matter how many events are on screen. hoverKey flips immediately
  // (for the "which card is being hovered" check below); hoverReadyKey only flips after a short
  // delay, which is what actually triggers the fetch — so quickly passing the cursor over several
  // sessions doesn't fire a request per card.
  const [hoverKey, setHoverKey] = useState(null);
  const [hoverReadyKey, setHoverReadyKey] = useState(null);
  const hoverTimerRef = useRef(null);
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);
  const handleEventEnter = (key) => {
    if (!enableSessionDetail) return;
    setHoverKey(key);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoverReadyKey(key), 300);
  };
  const handleEventLeave = () => {
    setHoverKey(null);
    setHoverReadyKey(null);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  };
  const hoveredEvent = hoverReadyKey ? allEvents.find((e) => eventKey(e) === hoverReadyKey) : null;
  const { data: hoverSummary, isLoading: hoverLoading } = useSessionSummary(
    hoveredEvent?.sessionId, hoveredEvent?.classId, hoveredEvent?.date, !!hoveredEvent
  );
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

  // A week with a break but zero events would otherwise show a generic "Nothing scheduled"
  // message, which reads as broken rather than "this is a break" — so breaks alone keep the grid
  // (and its shaded/labeled break days) rendered instead of falling into the empty state.
  if (allEvents.length === 0 && !anyBreakInView) {
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
        {days.map((d) => {
          const brk = breakOnDate(d.format("YYYY-MM-DD"), breaks);
          return (
            <div key={d.format("YYYY-MM-DD")} style={{ padding: "10px 8px", textAlign: "center", borderLeft: `1px solid ${T.border}`, backgroundColor: brk ? T.breakBg : undefined }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase" }}>{d.format("ddd")}</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: d.isSame(dayjs(), "day") ? T.accent : T.ink }}>{d.format("D")}</p>
              {brk && <p style={{ margin: "2px 0 0", fontSize: 9, fontWeight: 700, color: T.breakText }} title={breakLabel(brk, resolveClassLabel)}>{breakLabel(brk, resolveClassLabel)}</p>}
            </div>
          );
        })}
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
          const brk = breakOnDate(dateKey, breaks);
          return (
            <div key={dateKey} style={{ position: "relative", borderLeft: `1px solid ${T.border}`, height: gridHeight, backgroundColor: brk ? T.breakBg : undefined }}>
              {hours.map((h) => (
                <div key={h} style={{ position: "absolute", top: (h - gridStartHour) * HOUR_PX, left: 0, right: 0, height: 0, borderTop: `1px solid ${T.border}` }} />
              ))}
              {dayEvents.map((e) => {
                const color = colorForCourse(e.courseId);
                const key = eventKey(e);
                const isHovered = enableSessionDetail && hoverKey === key;
                const status = enableSessionDetail ? statusByKey[statusKey(e)] : null;
                const health = status ? sessionHealth({ isFuture: dayjs(e.date).isAfter(today, "day"), ...status }) : null;
                return (
                  <div
                    key={key}
                    title={enableSessionDetail ? undefined : `${resolveCourseName(e.courseId)} · Session ${e.sessionOrder}: ${e.sessionTitle}`}
                    onMouseEnter={() => handleEventEnter(key)}
                    onMouseLeave={handleEventLeave}
                    onClick={() => enableSessionDetail && onOpenDetail(e)}
                    style={{
                      position: "absolute", top: top(e.startTime), height: height(e.startTime, e.endTime), left: 4, right: 4,
                      backgroundColor: color.bg, border: `1px solid ${isHovered ? color.text : color.border}`, borderRadius: 8, padding: "4px 6px", overflow: "hidden", boxSizing: "border-box",
                      cursor: enableSessionDetail ? "pointer" : "default", zIndex: isHovered ? 2 : 1, transition: "border-color 0.15s ease",
                    }}
                  >
                    {health && health !== "neutral" && (
                      <StatusDot health={health} title={health === "attention" ? "Needs attention" : health === "warning" ? "Grading in progress" : "All good"} />
                    )}
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
                    {enableSessionDetail && hoverReadyKey === key && (
                      <SessionHoverCard summary={hoverSummary} isLoading={hoverLoading} />
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

function MonthGrid({ weeks, anchor, eventsByDate, breaks, resolveCourseName, resolveClassLabel, emptyMessage, enableSessionDetail, onOpenDetail, statusByKey }) {
  const today = dayjs();
  const hasAny = weeks.some((w) => w.some((d) => (eventsByDate[d.format("YYYY-MM-DD")] || []).length > 0));
  const anyBreakInView = weeks.some((w) => w.some((d) => breakOnDate(d.format("YYYY-MM-DD"), breaks)));
  if (!hasAny && !anyBreakInView) {
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
            const brk = breakOnDate(dateKey, breaks);
            const visible = dayEvents.slice(0, 3);
            const overflow = dayEvents.length - visible.length;
            return (
              <div key={dateKey} style={{ minHeight: 92, padding: "6px 6px", borderLeft: `1px solid ${T.border}`, opacity: inMonth ? 1 : 0.4, backgroundColor: brk ? T.breakBg : undefined }}>
                <p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 800, color: d.isSame(dayjs(), "day") ? T.accent : T.ink }}>{d.format("D")}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {brk && (
                    <div
                      title={breakLabel(brk, resolveClassLabel)}
                      style={{ backgroundColor: "#fff", border: `1px solid ${T.breakBorder}`, borderRadius: 5, padding: "2px 5px", fontSize: 9.5, fontWeight: 700, color: T.breakText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {breakLabel(brk, resolveClassLabel)}
                    </div>
                  )}
                  {visible.map((e) => {
                    const color = colorForCourse(e.courseId);
                    const status = enableSessionDetail ? statusByKey[statusKey(e)] : null;
                    const health = status ? sessionHealth({ isFuture: dayjs(e.date).isAfter(today, "day"), ...status }) : null;
                    return (
                      <div
                        key={eventKey(e)}
                        title={`${resolveCourseName(e.courseId)} · Session ${e.sessionOrder}: ${e.sessionTitle}`}
                        onClick={() => enableSessionDetail && onOpenDetail(e)}
                        style={{
                          position: "relative", backgroundColor: color.bg, border: `1px solid ${color.border}`, borderRadius: 5, padding: "2px 5px", fontSize: 9.5, fontWeight: 700, color: color.text,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: enableSessionDetail ? "pointer" : "default",
                        }}
                      >
                        {health && health !== "neutral" && (
                          <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", backgroundColor: HEALTH[health].dot, marginRight: 4 }} />
                        )}
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

// Quick-glance preview on hover — the headline numbers only (see SessionDetailModal for the full
// roster). Rendered as a child of the hovered event card itself so it's naturally anchored to it
// with no coordinate math for the common case; the ref+layout-effect below only kicks in to flip
// the card to the opposite side when the default placement would run off the viewport (e.g. a
// session near the bottom or right edge of the visible grid).
function SessionHoverCard({ summary, isLoading }) {
  const ref = useRef(null);
  const [placement, setPlacement] = useState({ vertical: "bottom", horizontal: "left" });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vertical = rect.bottom > window.innerHeight - 8 ? "top" : "bottom";
    const horizontal = rect.right > window.innerWidth - 8 ? "right" : "left";
    setPlacement((p) => (p.vertical === vertical && p.horizontal === horizontal ? p : { vertical, horizontal }));
  }, [isLoading, summary]);

  const posStyle = placement.vertical === "bottom" ? { top: "100%", marginTop: 4 } : { bottom: "100%", marginBottom: 4 };
  const horizStyle = placement.horizontal === "left" ? { left: 0 } : { right: 0 };
  const baseStyle = {
    position: "absolute", ...posStyle, ...horizStyle, zIndex: 30, width: 216,
    backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 10,
    boxShadow: "0 10px 28px rgba(15,38,69,0.18), 0 2px 8px rgba(0,0,0,0.08)", padding: "12px 13px",
    cursor: "default", fontFamily: "Inter, sans-serif", animation: "cv-fadein 0.15s ease",
  };

  if (isLoading || !summary) {
    return (
      <div ref={ref} style={baseStyle}>
        <p style={{ margin: 0, fontSize: 11, color: T.inkFaint }}>Loading…</p>
      </div>
    );
  }

  const attendancePercent = summary.attendance.marked && summary.attendance.enrolledCount > 0
    ? Math.round((summary.attendance.counts.present / summary.attendance.enrolledCount) * 100) : null;
  const gradingPercent = summary.grading.totalLearners > 0
    ? Math.round((summary.grading.fullyGradedCount / summary.grading.totalLearners) * 100) : null;
  const gradingComplete = summary.grading.requiredCount > 0 && summary.grading.fullyGradedCount === summary.grading.totalLearners;
  const health = sessionHealth({
    isFuture: dayjs(summary.date).isAfter(dayjs(), "day"),
    attendanceMarked: summary.attendance.marked,
    attendancePercent,
    gradingRequired: summary.grading.requiredCount > 0,
    gradingComplete,
  });
  const hc = HEALTH[health];

  return (
    <div ref={ref} style={baseStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: T.ink }}>
          Session {summary.session.order} of {summary.session.totalSessions}
        </p>
        <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: hc.dot, flexShrink: 0 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <HoverStatBar
          icon={<IconAttendance color={T.inkMuted} />} label="Attendance"
          value={summary.attendance.marked ? `${summary.attendance.counts.present}/${summary.attendance.enrolledCount}` : "Not marked"}
          percent={attendancePercent}
          barColor={!summary.attendance.marked || (attendancePercent !== null && attendancePercent < 50) ? HEALTH.attention.dot : HEALTH.good.dot}
        />
        <HoverStatBar
          icon={<IconGrading color={T.inkMuted} />} label="Grading"
          value={summary.grading.requiredCount > 0 ? `${summary.grading.fullyGradedCount}/${summary.grading.totalLearners}` : "No assessment"}
          percent={summary.grading.requiredCount > 0 ? gradingPercent : null}
          barColor={gradingComplete ? HEALTH.good.dot : HEALTH.warning.dot}
        />
        {summary.grading.averagePercent !== null && (
          <HoverStatBar icon={<IconScore color={T.inkMuted} />} label="Avg score" value={`${summary.grading.averagePercent}%`} percent={summary.grading.averagePercent} barColor={T.accentMid} />
        )}
      </div>
      <p style={{ margin: "9px 0 0", fontSize: 9.5, fontWeight: 700, color: T.accentMid }}>Click for full detail →</p>
    </div>
  );
}

function HoverStatBar({ icon, label, value, percent, barColor }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.inkMuted }}>{icon}{label}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ink }}>{value}</span>
      </div>
      {percent !== null && <ProgressBar percent={percent} color={barColor} />}
    </div>
  );
}

function StatTile({ label, value, sub, health, icon }) {
  const hc = health ? HEALTH[health] : null;
  return (
    <div
      style={{
        padding: "11px 12px", backgroundColor: hc ? hc.bg : "#F8FAFF", border: `1px solid ${hc ? hc.border : T.border}`,
        borderRadius: 10, textAlign: "center", transition: "background-color 0.2s ease",
      }}
    >
      {icon && <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>{icon}</div>}
      <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: hc ? hc.text : T.ink }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 700, color: hc ? hc.text : T.inkFaint, opacity: hc ? 0.75 : 1, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      {sub && <p style={{ margin: "1px 0 0", fontSize: 9.5, color: hc ? hc.text : T.inkMuted, opacity: hc ? 0.7 : 1 }}>{sub}</p>}
    </div>
  );
}

const ATTENDANCE_BADGES = {
  present: { bg: "#D1FAE5", border: "#6EE7B7", text: "#047857", label: "Present" },
  absent:  { bg: "#FEE2E2", border: "#FCA5A5", text: "#B91C1C", label: "Absent" },
  late:    { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", label: "Late" },
  excused: { bg: "#E0F2FE", border: "#7DD3FC", text: "#075985", label: "Excused" },
};
function AttendanceBadge({ status }) {
  const s = ATTENDANCE_BADGES[status] || { bg: "#F3F4F6", border: T.border, text: T.inkMuted, label: status || "Unknown" };
  return (
    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {s.label}
    </span>
  );
}

// Attendance statuses worth a second look sort first — a teacher/hub admin opening this modal is
// usually checking "did anything go wrong," not reading an alphabetical roster.
const ATTENDANCE_SORT_PRIORITY = { absent: 0, late: 1, excused: 2, present: 3 };
function sortAttendanceRecords(records) {
  return [...records].sort((a, b) => (ATTENDANCE_SORT_PRIORITY[a.status] ?? 4) - (ATTENDANCE_SORT_PRIORITY[b.status] ?? 4));
}
// Same idea for grading: learners still awaiting grading first (least progress first within
// that group), then completed learners sorted lowest score first — a score that needs follow-up
// shouldn't be buried below a page of 100%s.
function sortGradingRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? 1 : -1;
    if (!a.ready) return a.gradedCount - b.gradedCount;
    return (a.percent ?? 0) - (b.percent ?? 0);
  });
}

// Full click-through detail for one calendar event — attendance roster + per-learner grading
// progress for that exact (class, session, date). Fetches independently of the calendar's own
// range query (see the enableSessionDetail doc comment on CalendarView above).
function SessionDetailModal({ event, resolveCourseName, onClose }) {
  const { data: summary, isLoading } = useSessionSummary(event?.sessionId, event?.classId, event?.date, !!event);

  const attendancePercent = summary?.attendance.marked && summary.attendance.enrolledCount > 0
    ? Math.round((summary.attendance.counts.present / summary.attendance.enrolledCount) * 100) : null;
  const gradingComplete = summary && summary.grading.requiredCount > 0 && summary.grading.fullyGradedCount === summary.grading.totalLearners;
  const attendanceHealth = summary ? (!summary.attendance.marked || (attendancePercent !== null && attendancePercent < 50) ? "attention" : "good") : null;
  const gradingHealth = summary ? (summary.grading.requiredCount === 0 ? null : gradingComplete ? "good" : "warning") : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.5)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff", borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)", animation: "cv-modal-in 0.18s ease",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {dayjs(event.date).format("dddd, D MMM YYYY")}
            </p>
            <h3 style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {resolveCourseName(event.courseId)}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>
              Session {event.sessionOrder}{event.sessionTitle ? `: ${event.sessionTitle}` : ""}
            </p>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: T.inkMuted, fontSize: 14, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {isLoading || !summary ? (
          <div style={{ padding: "50px 20px", textAlign: "center", color: T.inkFaint, fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18, animation: "cv-fadein 0.2s ease" }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: T.inkMuted }}>
              <span><strong style={{ color: T.ink }}>Class:</strong> {summary.class.gradeName}{summary.class.streamName ? ` — ${summary.class.streamName}` : ""}</span>
              <span><strong style={{ color: T.ink }}>Educator:</strong> {summary.teacher?.name || "Not assigned"}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <StatTile
                icon={<IconAttendance color={attendanceHealth ? HEALTH[attendanceHealth].text : T.inkFaint} size={16} />}
                label="Attendance"
                value={summary.attendance.marked ? `${summary.attendance.counts.present}/${summary.attendance.enrolledCount}` : "—"}
                sub={summary.attendance.marked ? "present" : "not marked"}
                health={attendanceHealth}
              />
              <StatTile
                icon={<IconGrading color={gradingHealth ? HEALTH[gradingHealth].text : T.inkFaint} size={16} />}
                label="Graded"
                value={summary.grading.requiredCount > 0 ? `${summary.grading.fullyGradedCount}/${summary.grading.totalLearners}` : "—"}
                sub={summary.grading.requiredCount > 0 ? "learners" : "no assessment"}
                health={gradingHealth}
              />
              <StatTile
                icon={<IconScore color={T.inkFaint} size={16} />}
                label="Avg Score"
                value={summary.grading.averagePercent !== null ? `${summary.grading.averagePercent}%` : "—"}
                sub="class average"
              />
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Attendance</p>
              {!summary.attendance.marked ? (
                <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint, fontStyle: "italic" }}>Not marked for this date yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sortAttendanceRecords(summary.attendance.records).map((r) => (
                    <div key={r.learnerId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 11px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12.5 }}>
                      <span style={{ color: T.ink, fontWeight: 600 }}>{r.learner ? `${r.learner.firstName} ${r.learner.lastName}` : "Unknown learner"}</span>
                      <AttendanceBadge status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {summary.grading.requiredCount > 0 && (
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Grading Progress</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sortGradingRows(summary.grading.learnerRows).map((r) => (
                    <div key={r.learner.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "7px 11px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12.5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: T.ink, fontWeight: 600 }}>{r.learner.firstName} {r.learner.lastName}</span>
                        <span style={{ fontWeight: 700, color: r.ready ? HEALTH.good.text : HEALTH.warning.text }}>
                          {r.ready ? `${r.percent}%` : `${r.gradedCount}/${r.requiredCount} graded`}
                        </span>
                      </div>
                      <ProgressBar
                        percent={r.ready ? r.percent : (r.requiredCount > 0 ? Math.round((r.gradedCount / r.requiredCount) * 100) : 0)}
                        color={r.ready ? HEALTH.good.dot : HEALTH.warning.dot}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
