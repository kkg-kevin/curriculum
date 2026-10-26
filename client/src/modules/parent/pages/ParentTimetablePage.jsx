import { useCallback, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import CalendarView from "../../timetable/components/CalendarView";
import { useCoursesForPairs } from "../../curriculum/hooks/useCurriculumVersion";
import { T } from "../../learner-portal/components/profile/theme";
import { useParentTimetable } from "../hooks/useParent";
import { childColor } from "../components/childColors";

const chip = (active, color) => ({
  display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999,
  border: `1.5px solid ${active ? color : T.border}`, background: active ? `${color}14` : "#fff",
  color: active ? color : T.inkMuted, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif",
});

// Every child's sessions in one calendar, each labelled with whose it is; narrow it to one child.
export default function ParentTimetablePage() {
  const { children } = useOutletContext();
  const [only, setOnly] = useState("all");
  const [range, setRange] = useState(null);
  const onRangeChange = useCallback((r) => setRange(r), []);
  const { data, isLoading } = useParentTimetable(range?.from, range?.to);

  // A class's label is the child (or children) in it.
  const namesByClass = useMemo(() => {
    const map = new Map();
    children.forEach((c) => c.hubs.forEach((h) => {
      if (!h.classId) return;
      map.set(h.classId, [...(map.get(h.classId) || []), c.firstName]);
    }));
    return map;
  }, [children]);
  const pairs = useMemo(
    () => children.flatMap((c) => c.hubs.filter((h) => h.curriculumId && h.gradeId).map((h) => ({ curriculumId: h.curriculumId, gradeId: h.gradeId }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [children.map((c) => c.hubs.map((h) => `${h.curriculumId}:${h.gradeId}`).join(",")).join("|")]
  );
  const { data: courseById } = useCoursesForPairs(pairs);

  const events = (data?.data || []).filter((e) => only === "all" || (e.learnerIds || []).includes(only));
  const classIds = new Set(events.map((e) => e.classId));
  const breaks = (data?.breaks || []).filter((b) => only === "all" || (b.classIds || []).some((id) => classIds.has(id)));

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: T.ink }}>Family timetable</h1>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>
          {children.length > 1 ? "Every child's sessions in one place — each one says whose it is." : "Your child's sessions."}
        </p>
      </div>

      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setOnly("all")} style={chip(only === "all", T.accent)}>Everyone</button>
          {children.map((c, i) => (
            <button key={c.id} type="button" onClick={() => setOnly(c.id)} style={chip(only === c.id, childColor(i))}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: childColor(i) }} />
              {c.firstName}
            </button>
          ))}
        </div>
      )}

      <CalendarView
        events={events}
        breaks={breaks}
        isLoading={isLoading}
        resolveCourseName={(courseId) => courseById?.get(courseId)?.name || "Course"}
        resolveClassLabel={(classId) => (namesByClass.get(classId) || []).join(" & ") || undefined}
        onRangeChange={onRangeChange}
        emptyMessage="Nothing scheduled yet — the hub hasn't published a timetable for your children's classes."
      />
    </div>
  );
}
