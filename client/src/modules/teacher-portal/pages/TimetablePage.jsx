import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCoursesByGrade } from "../../curriculum/hooks/useCurriculumVersion";
import { useMyTeacherCalendar } from "../../timetable/hooks/useTimetable";
import CalendarView from "../../timetable/components/CalendarView";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  inkFaint: "#9CA3AF",
};

export default function TimetablePage() {
  const { teacher, teacherLoading, selectedHub, selectedHubId } = useOutletContext();

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "byTeacherHub", teacher?.id, selectedHubId],
    queryFn:  () => classApi.getAll({ teacherId: teacher.id, schoolId: selectedHubId }),
    enabled:  !!teacher?.id && !!selectedHubId,
  });
  const myClasses = classesData?.data || [];
  const classNameById = new Map(myClasses.map((c) => [c.id, `${c.gradeName}${c.streamName ? ` — ${c.streamName}` : ""}`]));
  const gradeIds = [...new Set(myClasses.map((c) => c.gradeId))];

  const { data: coursesByGrade } = useCurriculumCoursesByGrade(selectedHub?.curriculumId, gradeIds);
  const resolveCourseName = (courseId) => {
    for (const gradeId of gradeIds) {
      const found = coursesByGrade?.get(gradeId)?.find((c) => c.id === courseId);
      if (found) return found.name;
    }
    return "Course";
  };

  const [calendarRange, setCalendarRange] = useState(null);
  const onRangeChange = useCallback((r) => setCalendarRange(r), []);
  const { data: calendarData, isLoading: calendarLoading } = useMyTeacherCalendar(calendarRange?.from, calendarRange?.to);
  const events = calendarData?.data || [];
  const breaks = calendarData?.breaks || [];

  const isLoading = teacherLoading || classesLoading;

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>My Timetable</h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>Your teaching schedule across every class you're assigned to.</p>
      </div>

      <CalendarView
        events={events}
        breaks={breaks}
        isLoading={calendarLoading}
        resolveCourseName={resolveCourseName}
        resolveTeacherLabel={(event) => classNameById.get(event.classId) || "Class"}
        onRangeChange={onRangeChange}
        emptyMessage="Nothing scheduled yet — your school hasn't set course start dates for your classes."
      />
    </div>
  );
}
