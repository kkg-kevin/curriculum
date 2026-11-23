import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import { FiChevronRight, FiClock } from "react-icons/fi";
import { classApi } from "../../classes/services/classApi";
import { useMyTeacherCalendar } from "../../timetable/hooks/useTimetable";
import CalendarView from "../../timetable/components/CalendarView";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

export default function TimetablePage() {
  const { teacher, teacherLoading, hubs } = useOutletContext();

  // Every class this teacher teaches, across EVERY hub they're linked to (not just the
  // currently-selected one) — the calendar data itself (useMyTeacherCalendar below) already
  // merges all hubs server-side; this is what lets labels/filtering cover that same full set
  // instead of only resolving names for whichever hub happens to be selected elsewhere in the
  // portal chrome.
  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "byTeacher", teacher?.id],
    queryFn:  () => classApi.getAll({ teacherId: teacher.id }),
    enabled:  !!teacher?.id,
  });
  const myClasses = classesData?.data || [];
  const classNameById = new Map(myClasses.map((c) => [c.id, `${c.gradeName}${c.streamName ? ` — ${c.streamName}` : ""}`]));
  const classIdToHubId = new Map(myClasses.map((c) => [c.id, c.schoolId]));

  const [calendarRange, setCalendarRange] = useState(null);
  const onRangeChange = useCallback((r) => setCalendarRange(r), []);
  const { data: calendarData, isLoading: calendarLoading } = useMyTeacherCalendar(calendarRange?.from, calendarRange?.to);
  const allEvents = calendarData?.data || [];
  const allBreaks = calendarData?.breaks || [];
  const allSkippedSessions = calendarData?.skippedSessions || [];
  // Their mentor sessions and parent check-ins, on the same calendar. They belong to no hub filter.
  const extras = calendarData?.extras || [];

  // "All Hubs" (default) shows every class across every hub merged into one calendar; picking
  // one hub narrows both events and breaks down to just that hub's classes — same "Viewing"
  // filter pattern already used on the school-portal Timetable page's "All Classes" mode.
  const [filterHubId, setFilterHubId] = useState("all");
  const events = filterHubId === "all" ? allEvents : allEvents.filter((e) => (e.hubId || classIdToHubId.get(e.classId)) === filterHubId);
  const breaks = filterHubId === "all"
    ? allBreaks
    : allBreaks
        .map((b) => ({ ...b, classIds: (b.classIds || []).filter((id) => classIdToHubId.get(id) === filterHubId) }))
        .filter((b) => b.classIds.length > 0);
  const skippedSessions = filterHubId === "all"
    ? allSkippedSessions
    : allSkippedSessions.filter((s) => classIdToHubId.get(s.classId) === filterHubId);

  const isLoading = teacherLoading || classesLoading;

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>My Timetable</h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
          Your teaching schedule across every class you're assigned to{hubs?.length > 1 ? ", across every hub" : ""}.
        </p>
      </div>

      {/* Availability has its own page and menu item (23 Nov 2026) — mentors couldn't find the tab. */}
      <Link to="/teacher-portal/availability" style={{ ...cardStyle, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: T.accent, fontSize: 13, fontWeight: 700 }}>
        <FiClock size={16} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Set the hours families can book you for mentor sessions</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>My Availability <FiChevronRight size={14} /></span>
      </Link>

      {hubs?.length > 1 && (
        <div role="group" aria-label="Show sessions at" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ id: "all", name: "All hubs" }, ...hubs].map((h) => {
            const on = filterHubId === h.id;
            return <button key={h.id} type="button" aria-pressed={on} onClick={() => setFilterHubId(h.id)} style={{ padding: "6px 13px", borderRadius: 999, border: `1.5px solid ${on ? T.accent : T.border}`, backgroundColor: on ? T.accent : "#fff", color: on ? "#fff" : T.inkMuted, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>{h.name}</button>;
          })}
        </div>
      )}

      <CalendarView
        events={events}
        breaks={breaks}
        skippedSessions={skippedSessions}
        isLoading={calendarLoading}
        defaultMode="agenda"
        extras={filterHubId === "all" ? extras : []}
        showHub={hubs?.length > 1 && filterHubId === "all"}
        colorBy={hubs?.length > 1 ? "hub" : "course"}
        resolveTeacherLabel={(event) => event.className || classNameById.get(event.classId) || "Class"}
        resolveClassLabel={(classId) => classNameById.get(classId)}
        onRangeChange={onRangeChange}
        emptyMessage="Nothing scheduled yet — your school hasn't set course start dates for your classes."
        enableSessionDetail
        enableReschedule
      />
    </div>
  );
}
