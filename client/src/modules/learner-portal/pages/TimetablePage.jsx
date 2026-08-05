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
  const { cls, hubs, isLoading: scopeLoading } = useOutletContext();
  const { data: courses = [] } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeId);
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  // A learner can be actively enrolled at more than one hub at once (see resolveLearnerCalendar
  // in timetable.service.js), each possibly on a different curriculum with its own independent
  // term calendar — this is what lets a break shown in the merged calendar below name which of
  // the learner's hubs it actually belongs to, rather than reading as if it applies to all of them.
  const classNameById = new Map(
    (hubs || []).filter((h) => h.class).map((h) => [h.class.id, `${h.class.gradeName}${h.class.streamName ? ` — ${h.class.streamName}` : ""}`])
  );

  const [calendarRange, setCalendarRange] = useState(null);
  const onRangeChange = useCallback((r) => setCalendarRange(r), []);
  const { data: calendarData, isLoading: calendarLoading } = useMyLearnerCalendar(calendarRange?.from, calendarRange?.to);
  const events = calendarData?.data || [];
  const breaks = calendarData?.breaks || [];

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
        breaks={breaks}
        isLoading={calendarLoading}
        resolveCourseName={(courseId) => courseNameById.get(courseId) || "Course"}
        resolveClassLabel={(classId) => classNameById.get(classId)}
        onRangeChange={onRangeChange}
        emptyMessage="Nothing scheduled yet — your school hasn't published a timetable for your class."
      />
    </div>
  );
}
