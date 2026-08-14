import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { classApi } from "../../classes/services/classApi";
import { useCoursesForPairs } from "../../curriculum/hooks/useCurriculumVersion";
import { useMyTeacherCalendar } from "../../timetable/hooks/useTimetable";
import CalendarView from "../../timetable/components/CalendarView";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const selectStyle = {
  padding: "8px 32px 8px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13,
  fontFamily: "Inter, sans-serif", backgroundColor: "#fff", color: T.ink, outline: "none", cursor: "pointer",
  appearance: "none", minWidth: 200,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
};

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

  // Each hub can run a different curriculum — resolve course names per (curriculumId, gradeId)
  // pair rather than assuming one shared curriculum across every class.
  const coursePairs = useMemo(() => {
    const seen = new Set();
    const pairs = [];
    myClasses.forEach((c) => {
      const key = `${c.curriculumId}:${c.gradeId}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ curriculumId: c.curriculumId, gradeId: c.gradeId });
    });
    return pairs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClasses.map((c) => `${c.curriculumId}:${c.gradeId}`).join(",")]);
  const { data: courseById } = useCoursesForPairs(coursePairs);
  const resolveCourseName = (courseId) => courseById?.get(courseId)?.name || "Course";

  const [calendarRange, setCalendarRange] = useState(null);
  const onRangeChange = useCallback((r) => setCalendarRange(r), []);
  const { data: calendarData, isLoading: calendarLoading } = useMyTeacherCalendar(calendarRange?.from, calendarRange?.to);
  const allEvents = calendarData?.data || [];
  const allBreaks = calendarData?.breaks || [];

  // "All Hubs" (default) shows every class across every hub merged into one calendar; picking
  // one hub narrows both events and breaks down to just that hub's classes — same "Viewing"
  // filter pattern already used on the school-portal Timetable page's "All Classes" mode.
  const [filterHubId, setFilterHubId] = useState("all");
  const events = filterHubId === "all" ? allEvents : allEvents.filter((e) => classIdToHubId.get(e.classId) === filterHubId);
  const breaks = filterHubId === "all"
    ? allBreaks
    : allBreaks
        .map((b) => ({ ...b, classIds: (b.classIds || []).filter((id) => classIdToHubId.get(id) === filterHubId) }))
        .filter((b) => b.classIds.length > 0);

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

      {hubs?.length > 1 && (
        <div style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkMuted }}>Viewing</label>
          <select value={filterHubId} onChange={(e) => setFilterHubId(e.target.value)} style={selectStyle}>
            <option value="all">All Hubs</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
      )}

      <CalendarView
        events={events}
        breaks={breaks}
        isLoading={calendarLoading}
        resolveCourseName={resolveCourseName}
        resolveTeacherLabel={(event) => classNameById.get(event.classId) || "Class"}
        resolveClassLabel={(classId) => classNameById.get(classId)}
        onRangeChange={onRangeChange}
        emptyMessage="Nothing scheduled yet — your school hasn't set course start dates for your classes."
        enableSessionDetail
      />
    </div>
  );
}
