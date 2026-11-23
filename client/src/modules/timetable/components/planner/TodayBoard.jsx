import { useMemo, useState } from "react";
import { FiAlertTriangle, FiChevronLeft, FiChevronRight, FiMapPin, FiVideo } from "react-icons/fi";
import { BRAND, FONT, card, pill } from "../../../../theme/brand";
import { usePlannerCalendar } from "../../hooks/usePlanner";
import { addDaysTo, fmtDate, fmtRange } from "./shared";

// The day at a glance: every session on the real calendar (breaks, moved sessions and covers
// included), by hub and room, with anything missing called out.
export default function TodayBoard({ hubId, data }) {
  const [date, setDate] = useState(data.today);
  const { data: calendar, isLoading } = usePlannerCalendar(hubId, date, date);
  const educatorOf = useMemo(() => {
    const map = new Map();
    for (const c of data.classes) for (const course of c.courses) map.set(`${c.id}|${course.id}`, course.educators.map((e) => e.name).join(", "));
    return map;
  }, [data.classes]);
  const nameOfTeacher = useMemo(() => new Map(data.educators.map((e) => [e.id, e.name])), [data.educators]);

  const groups = useMemo(() => {
    const seen = new Set();
    const events = (calendar?.data || []).filter((e) => {
      if (e.date !== date) return false;
      const k = `${e.classId}|${e.courseId}|${e.startTime}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const hubs = new Map();
    for (const e of events) {
      const hub = hubs.get(e.hubId) || hubs.set(e.hubId, { id: e.hubId, name: e.hubName, online: e.online, rooms: new Map() }).get(e.hubId);
      const room = e.room || "No room set";
      hub.rooms.set(room, [...(hub.rooms.get(room) || []), e]);
    }
    return [...hubs.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [calendar, date]);
  const total = groups.reduce((n, h) => n + [...h.rooms.values()].reduce((m, l) => m + l.length, 0), 0);
  const nav = { display: "flex", padding: 8, borderRadius: 8, border: `1.5px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, cursor: "pointer" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FONT }}>
      <div style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" aria-label="Previous day" onClick={() => setDate((d) => addDaysTo(d, -1))} style={nav}><FiChevronLeft size={15} /></button>
        <button type="button" aria-label="Next day" onClick={() => setDate((d) => addDaysTo(d, 1))} style={nav}><FiChevronRight size={15} /></button>
        {date !== data.today && <button type="button" onClick={() => setDate(data.today)} style={{ ...nav, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, fontFamily: FONT }}>Today</button>}
        <h2 style={{ margin: "0 4px", fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{date === data.today ? "Today · " : ""}{fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}</h2>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: BRAND.muted }}>{isLoading ? "Loading…" : `${total} session${total === 1 ? "" : "s"}`}</span>
      </div>
      {!isLoading && !groups.length && <div style={{ ...card, padding: "36px 20px", textAlign: "center", fontSize: 13.5, color: BRAND.muted }}>Nothing on this day.</div>}
      {groups.map((hub) => (
        <section key={hub.id} style={{ ...card, overflow: "hidden" }}>
          <h3 style={{ margin: 0, padding: "9px 14px", fontSize: 13, fontWeight: 800, color: BRAND.navy, background: BRAND.canvas, display: "flex", alignItems: "center", gap: 6 }}>{hub.online ? <FiVideo size={13} /> : <FiMapPin size={13} />} {hub.name}</h3>
          <div style={{ display: "grid", gap: 0, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
            {[...hub.rooms.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([room, list]) => (
              <div key={room} style={{ padding: "9px 14px", borderTop: `1px solid ${BRAND.line}` }}>
                <p style={{ margin: "0 0 5px", fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{room}</p>
                <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%" }}>
                  {[...list].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((e) => {
                    const who = e.cover?.status === "accepted" ? `${e.cover.coverTeacherName} (covering)` : (e.teacherId && nameOfTeacher.get(e.teacherId)) || educatorOf.get(`${e.classId}|${e.courseId}`) || "";
                    return (
                      <div key={`${e.classId}-${e.courseId}-${e.startTime}`} style={{ padding: "7px 9px", borderRadius: 8, background: BRAND.canvas }}>
                        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: BRAND.navy }}>{fmtRange(e.startTime, e.endTime)}</p>
                        <p style={{ margin: "1px 0 0", fontSize: 13, fontWeight: 800, color: BRAND.ink }}>{e.courseName || "Course"}</p>
                        <p style={{ margin: "1px 0 0", fontSize: 12, color: BRAND.muted }}>{e.className}{who ? ` · ${who}` : ""}</p>
                        {!who && <span style={{ ...pill("waiting", { fontSize: 10.5, marginTop: 4 }) }}><FiAlertTriangle size={10} /> No educator</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
