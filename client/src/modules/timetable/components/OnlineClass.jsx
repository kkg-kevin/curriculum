import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { FiVideo } from "react-icons/fi";
import { useMyLearnerCalendar, useMyTeacherCalendar } from "../hooks/useTimetable";

const T = {
  accent: "#25476a", ink: "#111827", inkMuted: "#6B7280", border: "#E5E7EB",
  live: "#047857", liveBg: "#D1FAE5", liveBorder: "#6EE7B7",
};

const at = (date, time) => dayjs(`${date}T${String(time || "00:00").slice(0, 5)}`);

// The hub's joining link when it teaches online (virtual / hybrid) — the same rule the server
// applies to calendar events in onlineLinkForClass (timetable.service.js).
export function onlineLinkOf(hub) {
  return hub?.meetingLink && ["virtual", "hybrid"].includes(hub.deliveryMode) ? hub.meetingLink : null;
}

// A session counts as "live" from 15 minutes before it starts until it ends — the Join button
// turns green then. Joining is never blocked outside that window; the meeting room is the hub's.
export function isLive(event, now = dayjs()) {
  return now.isAfter(at(event.date, event.startTime).subtract(15, "minute")) && now.isBefore(at(event.date, event.endTime || event.startTime));
}

// The next online session still to come (or under way). Calendar events carry `meetingLink` only
// when their class's hub is online / hybrid — see onlineLinkForClass in timetable.service.js.
export function nextOnlineEvent(events, now = dayjs()) {
  return (events || [])
    .filter((e) => e.meetingLink && at(e.date, e.endTime || e.startTime).isAfter(now))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.startTime).localeCompare(String(b.startTime)))[0] || null;
}

function relativeDay(date) {
  const d = dayjs(date);
  if (d.isSame(dayjs(), "day")) return "Today";
  if (d.isSame(dayjs().add(1, "day"), "day")) return "Tomorrow";
  return d.format("ddd D MMM");
}

// Opens the hub's meeting (Google Meet, Zoom…) in a new tab — Meet can't be embedded in a page.
// Stops the click there so it never also opens a calendar card's own detail view.
export function JoinOnlineButton({ href, live = false, size = "md", label = "Join online" }) {
  const small = size === "sm";
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex", alignItems: "center", gap: small ? 4 : 6, flexShrink: 0, textDecoration: "none", fontFamily: "Inter, sans-serif",
        padding: small ? "1px 6px" : "9px 16px", borderRadius: small ? 5 : 10, fontSize: small ? 9.5 : 13, fontWeight: 700,
        backgroundColor: live ? T.live : small ? "rgba(255,255,255,0.75)" : T.accent,
        color: live || !small ? "#fff" : T.accent, border: small ? `1px solid ${live ? T.live : T.border}` : "none",
      }}
    >
      <FiVideo size={small ? 10 : 14} /> {label}
    </a>
  );
}

// The person's own sessions for the coming week, re-read against the clock every minute so a
// Join button turns "live" on time. Every strip/card on a page shares one cached calendar query.
function useUpcomingSessions(who) {
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const from = now.format("YYYY-MM-DD");
  const to = now.add(7, "day").format("YYYY-MM-DD");
  const teacherCalendar = useMyTeacherCalendar(who === "teacher" ? from : null, to);
  const learnerCalendar = useMyLearnerCalendar(who === "learner" ? from : null, to);
  const events = (who === "teacher" ? teacherCalendar : who === "learner" ? learnerCalendar : null)?.data?.data;
  return { events: events || [], now };
}

const whenText = (event) =>
  `${relativeDay(event.date)}, ${String(event.startTime).slice(0, 5)}${event.endTime ? ` – ${String(event.endTime).slice(0, 5)}` : ""}`;

// "Online class" on a hub's own pages — My Courses, a course, an educator's class. Shown whenever
// the hub teaches online, with or without a session this week, so the meeting room is always one
// click from the course. Narrowed to one class and/or course when given.
export function OnlineClassStrip({ who, hub, classId, courseId, compact = false, style }) {
  const link = onlineLinkOf(hub);
  const { events, now } = useUpcomingSessions(link ? who : null);
  if (!link) return null;

  const event = nextOnlineEvent(
    events.filter((e) => e.meetingLink === link && (!classId || e.classId === classId) && (!courseId || e.courseId === courseId)),
    now,
  );
  const live = !!event && isLive(event, now);
  const label = who === "teacher" ? "Start online class" : "Join online class";
  const status = live ? "Live now" : event ? `Next: ${whenText(event)}` : "No session in the next 7 days";

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "8px 10px", borderRadius: 10, backgroundColor: live ? T.liveBg : "#F0F9FF", border: `1px solid ${live ? T.liveBorder : "#BAE6FD"}`, fontFamily: "Inter, sans-serif" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: live ? T.live : T.accent, fontWeight: 700, minWidth: 0 }}>
          <FiVideo size={13} /> Online · <span style={{ fontWeight: 600, color: live ? T.live : T.inkMuted }}>{status}</span>
        </span>
        <JoinOnlineButton href={link} live={live} size="sm" label={who === "teacher" ? "Start" : "Join"} />
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: live ? T.liveBg : "#fff", border: `1.5px solid ${live ? T.liveBorder : T.border}`, borderRadius: 14,
      padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: "Inter, sans-serif", ...style,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: live ? T.live : "#E8F5FB", color: live ? "#fff" : T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <FiVideo size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: live ? T.live : T.ink }}>
          Online class{hub.name ? ` · ${hub.name}` : ""}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 12.5, color: T.inkMuted }}>
          {status}{event?.sessionTitle && !live ? ` · ${event.sessionTitle}` : ""}
        </p>
      </div>
      <JoinOnlineButton href={link} live={live} label={label} />
    </div>
  );
}

// A small "Online" tag beside a hub's name in a list.
export function OnlineTag({ hub }) {
  if (!["virtual", "hybrid"].includes(hub?.deliveryMode)) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 6, padding: "1px 7px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, color: T.accent, backgroundColor: "#E8F5FB", border: "1px solid #BAE6FD", verticalAlign: "middle" }}>
      <FiVideo size={10} /> {hub.deliveryMode === "hybrid" ? "Hybrid" : "Online"}
    </span>
  );
}

// "Next online class" on a portal dashboard — nothing at all unless one of the person's classes
// belongs to an online / hybrid hub with a joining link.
export function NextOnlineClassCard({ who, resolveCourseName }) {
  const { events, now } = useUpcomingSessions(who);
  const event = nextOnlineEvent(events, now);
  if (!event) return null;
  const live = isLive(event, now);
  const courseName = resolveCourseName?.(event.courseId);

  return (
    <div style={{
      backgroundColor: live ? T.liveBg : "#fff", border: `1.5px solid ${live ? T.liveBorder : T.border}`, borderRadius: 16,
      padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontFamily: "Inter, sans-serif",
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: live ? T.live : "#E8F5FB", color: live ? "#fff" : T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <FiVideo size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: live ? T.live : T.inkMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {live ? "Online class — live now" : "Next online class"}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 14.5, fontWeight: 800, color: T.ink }}>
          {courseName || `Session ${event.sessionOrder}`}{event.sessionTitle ? ` · ${event.sessionTitle}` : ""}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>
          {whenText(event)}
        </p>
      </div>
      <JoinOnlineButton href={event.meetingLink} live={live} label={who === "teacher" ? "Start online class" : "Join online class"} />
    </div>
  );
}
