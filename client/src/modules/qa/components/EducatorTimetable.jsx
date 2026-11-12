import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiCalendar, FiChevronDown, FiChevronUp, FiClock, FiMapPin } from "react-icons/fi";
import { qaApi } from "../services/qaApi";
import { T, hint } from "../shared";

// An educator's week (courses still running) and the next four weeks — real sessions, from the
// calendar engine (breaks, start dates, sessions shifted, merged or moved), beside the Plan a visit form (server: GET
// /api/qa/educators/:id/schedule): their classes by weekday, the hours they're free, and — for the
// date being picked — what they're doing that day. Tapping a class session in "Coming up" picks
// its day (and its hub) for the visit.
const WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SHORT = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
const KIND = {
  class: { label: "Class", bg: "#E6ECF3", fg: "#25476a" },
  qa: { label: "QA visit", bg: "#FFF5E1", fg: "#7A4F00" },
  mentor: { label: "Mentor session", bg: "#EAF6FD", fg: "#1F6F9E" },
};
const dayName = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const weekdayOf = (date) => WEEK[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];

function Item({ e, onPick, picked }) {
  const look = KIND[e.kind] || KIND.class;
  const pickable = e.kind === "class" && onPick;
  const Tag = pickable ? "button" : "div";
  return (
    <Tag type={pickable ? "button" : undefined} onClick={pickable ? () => onPick(e) : undefined} title={pickable ? "Plan the visit for this session" : undefined}
      style={{ display: "flex", gap: 8, alignItems: "flex-start", width: "100%", textAlign: "left", padding: "7px 9px", borderRadius: 9, border: `1.5px solid ${picked ? "#25476a" : "#EEF1F5"}`, background: picked ? "#E6ECF3" : "#fff", cursor: pickable ? "pointer" : "default", fontFamily: "inherit" }}>
      <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: look.bg, color: look.fg, marginTop: 1 }}>{e.startTime ? `${e.startTime}–${e.endTime}` : look.label}</span>
      <span style={{ minWidth: 0, fontSize: 12.5, color: T.ink, lineHeight: 1.35 }}>
        <strong>{e.title}</strong>{e.sessions?.length ? <span style={{ color: T.inkMuted }}> · Session {e.sessions.join(" & ")}</span> : null}
        {(e.hubName || e.roomName) && <span style={{ display: "block", color: T.inkMuted }}>{[e.hubName, e.roomName].filter(Boolean).join(" · ")}</span>}
      </span>
    </Tag>
  );
}

export default function EducatorTimetable({ teacherId, date, hubId, onPick }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["qa", "educator-schedule", teacherId],
    queryFn: () => qaApi.educatorSchedule(teacherId),
    enabled: !!teacherId,
    staleTime: 60 * 1000,
  });
  const [showAll, setShowAll] = useState(false);
  const byDate = useMemo(() => {
    const map = new Map();
    for (const e of data?.upcoming || []) (map.get(e.date) || map.set(e.date, []).get(e.date)).push(e);
    return map;
  }, [data]);

  if (!teacherId) return null;
  if (isLoading) return <p style={hint}>Loading their timetable…</p>;
  if (isError || !data) return <p style={hint}>Their timetable couldn&rsquo;t be loaded.</p>;

  const onDay = date ? byDate.get(date) || [] : [];
  const freeThatDay = date ? data.available.filter((a) => a.dayOfWeek === weekdayOf(date)) : [];
  const dates = [...byDate.keys()];
  const shown = showAll ? dates : dates.slice(0, 6);
  const box = { border: "1px solid #E5E7EB", borderRadius: 12, padding: 12, background: "#FBFCFE", display: "grid", gap: 8, minWidth: 0 };
  const heading = { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#38aae1", display: "flex", gap: 6, alignItems: "center" };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* The chosen day first — what matters when picking a date. */}
      {date && (
        <div style={{ ...box, background: onDay.some((e) => e.kind === "class") ? "#F2F7FC" : "#FFFBF0", borderColor: onDay.some((e) => e.kind === "class") ? "#BFE3F7" : "#FDD89A" }}>
          <p style={heading}><FiCalendar size={12} /> {dayName(date)}</p>
          {onDay.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: "#7A4F00" }}>No class that day{freeThatDay.length ? ` — they're free ${freeThatDay.map((a) => `${a.startTime}–${a.endTime}`).join(", ")}` : ""}. Pick a day they teach to see them in class.</p>
          ) : onDay.map((e, i) => <Item key={`${e.kind}${i}`} e={e} />)}
          {onDay.some((e) => e.kind === "qa") && <p style={{ margin: 0, fontSize: 12, color: "#7A4F00" }}>They already have a QA visit that day.</p>}
        </div>
      )}

      <div style={box}>
        <p style={heading}><FiClock size={12} /> Their week</p>
        {data.weekly.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted }}>{data.finished ? `Their ${data.finished === 1 ? "course on the timetable has" : `${data.finished} courses on the timetable have`} finished — no classes coming up to see them in.` : "No classes on their timetable yet."}</p>
        ) : (
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))" }}>
            {WEEK.filter((d) => data.weekly.some((w) => w.dayOfWeek === d)).map((d) => (
              <div key={d} style={{ display: "grid", gap: 4, alignContent: "start" }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: T.inkMuted }}>{SHORT[d]}</span>
                {data.weekly.filter((w) => w.dayOfWeek === d).map((w) => (
                  <span key={w.id} style={{ fontSize: 11.5, lineHeight: 1.35, padding: "5px 7px", borderRadius: 8, background: w.hubId === hubId || !hubId ? "#E6ECF3" : "#F3F4F6", color: w.hubId === hubId || !hubId ? "#25476a" : "#6B7280" }}>
                    <strong>{w.startTime}–{w.endTime}</strong> {w.courseName || "Class"} · {w.className}
                    <span style={{ display: "flex", gap: 3, alignItems: "center" }}><FiMapPin size={10} /> {w.hubName}{w.roomName ? ` · ${w.roomName}` : ""}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
        {data.available.length > 0 && (
          <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>
            <strong>Free:</strong> {data.available.map((a) => `${SHORT[a.dayOfWeek]} ${a.startTime}–${a.endTime}`).join(" · ")}
          </p>
        )}
      </div>

      <div style={box}>
        <p style={heading}><FiCalendar size={12} /> Coming up (next 4 weeks)</p>
        {dates.length === 0 ? <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted }}>Nothing on their calendar.</p> : (
          <>
            {shown.map((d) => (
              <div key={d} style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: d === date ? "#25476a" : T.inkMuted }}>{dayName(d)}{d === date ? " — chosen" : ""}</span>
                {byDate.get(d).map((e, i) => <Item key={`${d}${i}`} e={e} picked={d === date && e.kind === "class" && (!hubId || e.hubId === hubId)} onPick={onPick} />)}
              </div>
            ))}
            {dates.length > 6 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} style={{ justifySelf: "start", background: "none", border: "none", color: "#2e7db5", fontWeight: 700, fontSize: 12.5, cursor: "pointer", display: "inline-flex", gap: 4, alignItems: "center", padding: 0 }}>
                {showAll ? <><FiChevronUp size={13} /> Fewer</> : <><FiChevronDown size={13} /> All {dates.length} days</>}
              </button>
            )}
            {onPick && <p style={{ ...hint, margin: 0 }}>Tap a class to plan the visit for that session.</p>}
          </>
        )}
      </div>
    </div>
  );
}
