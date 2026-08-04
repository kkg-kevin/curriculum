import { useCallback, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { useMyLearnerCalendar } from "../../timetable/hooks/useTimetable";
import CalendarView from "../../timetable/components/CalendarView";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  inkFaint: "#9CA3AF",
};

export default function TimetablePage() {
  const { cls, isLoading: scopeLoading } = useOutletContext();
  const { data: courses = [] } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeId);
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  const [calendarRange, setCalendarRange] = useState(null);
  const onRangeChange = useCallback((r) => setCalendarRange(r), []);
  const { data: events = [], isLoading: calendarLoading } = useMyLearnerCalendar(calendarRange?.from, calendarRange?.to);

  if (scopeLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>My Timetable</h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>Your class schedule.</p>
      </div>

      <CalendarView
        events={events}
        isLoading={calendarLoading}
        resolveCourseName={(courseId) => courseNameById.get(courseId) || "Course"}
        onRangeChange={onRangeChange}
        emptyMessage="Nothing scheduled yet — your school hasn't published a timetable for your class."
      />
    </div>
  );
}
