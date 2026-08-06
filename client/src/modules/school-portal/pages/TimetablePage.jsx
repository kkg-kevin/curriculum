import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learningHubApi as schoolApi } from "../../learning-hubs/services/learningHubApi";
import { classApi } from "../../classes/services/classApi";
import { useClassCourseTeachers } from "../../classes/hooks/useClasses";
import { useCurriculumCurrentCourses, useCurriculumCoursesByGrade } from "../../curriculum/hooks/useCurriculumVersion";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useAcademicYears } from "../../curriculum/hooks/useAcademicYear";
import { useProgramsByCurriculumQuery } from "../../programs/hooks/usePrograms";
import {
  useClassTimetable, useCreateSlot, useCreateSlotsBulk, useUpdateSlot, useDeleteSlot,
  useCourseSchedules, useSetCourseSchedule, useSetCourseScheduleBulk, useClassCalendar, useHubCalendar,
} from "../../timetable/hooks/useTimetable";
import { DAYS_OF_WEEK, DAY_LABELS } from "../../timetable/schemas/timetable.schema";
import CalendarView from "../../timetable/components/CalendarView";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const selectStyle = {
  padding: "8px 32px 8px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13,
  fontFamily: "Inter, sans-serif", backgroundColor: "#fff", color: T.ink, outline: "none", cursor: "pointer",
  appearance: "none", maxWidth: "100%",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
};
const inputStyle = { boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink, outline: "none" };

function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function fmtShort(d) {
  return d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

// A slot's teacherId is an optional override — when unset, it's implicitly whichever educator(s)
// are linked to that course in this class (see class-course-teacher-link.model.js), same
// resolution ClassViewPage.jsx's CourseEducatorRow already does.
function resolveTeacherLabel(slot, courseLinks) {
  if (slot.teacherId) {
    const link = courseLinks.find((l) => l.teacherId === slot.teacherId);
    return link ? `${link.teacher.firstName} ${link.teacher.lastName}` : "Educator";
  }
  const primary = courseLinks.find((l) => l.courseId === slot.courseId && l.isPrimary);
  if (primary) return `${primary.teacher.firstName} ${primary.teacher.lastName}`;
  const any = courseLinks.find((l) => l.courseId === slot.courseId);
  return any ? `${any.teacher.firstName} ${any.teacher.lastName}` : "No educator assigned";
}

// Toggle-pill picker for "also apply this to other classes" — offered wherever a slot or start
// date gets created, scoped to siblings (same grade + curriculum as the class currently being
// viewed) so every offered class is guaranteed to actually have the course being scheduled.
function ClassMultiPicker({ siblings, selectedIds, onChange, label }) {
  if (siblings.length === 0) return null;
  const allSelected = selectedIds.length === siblings.length;
  const toggle = (id) => onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.inkMuted }}>{label}</span>
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : siblings.map((s) => s.id))}
          style={{ background: "none", border: "none", color: T.accentMid, fontSize: 11, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", padding: 0 }}
        >
          {allSelected ? "Clear" : "Select all"}
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {siblings.map((s) => {
          const active = selectedIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
                border: `1.5px solid ${active ? T.accent : T.border}`, backgroundColor: active ? T.accent : "#fff", color: active ? "#fff" : T.inkMuted,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// lockedDay is set only on the "add" flow, where the day is already implied by which day's
// section the "+ Add Slot" button was clicked in — showing an editable dropdown there too would
// let it silently disagree with the section it actually gets created under. Editing an existing
// slot (initial provided, no lockedDay) still gets the full dropdown, since moving a slot to a
// different day is a reasonable thing to want.
function SlotForm({ courses, courseLinks, onSubmit, onCancel, initial, isSaving, lockedDay, siblingClasses = [] }) {
  const [form, setForm] = useState(() => initial || {
    courseId: "", teacherId: "", dayOfWeek: lockedDay || "monday", startTime: "", endTime: "", room: "",
  });
  const [applyToClassIds, setApplyToClassIds] = useState([]);
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const teachersForCourse = courseLinks.filter((l) => l.courseId === form.courseId);
  // Bulk-apply only makes sense when creating a brand new slot — editing one existing slot across
  // several classes at once would mean silently touching records the school didn't ask to change.
  const isCreating = !initial;

  const submit = () => {
    if (!form.courseId || !form.startTime || !form.endTime) return;
    onSubmit({ ...form, teacherId: form.teacherId || null, applyToClassIds });
  };

  return (
    <div style={{ ...cardStyle, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, border: `1.5px solid ${T.tintBorder}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {lockedDay ? (
          <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700, color: T.ink }}>{DAY_LABELS[lockedDay]}</div>
        ) : (
          <select value={form.dayOfWeek} onChange={(e) => set("dayOfWeek", e.target.value)} style={selectStyle}>
            {DAYS_OF_WEEK.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
          </select>
        )}
        <select value={form.courseId} onChange={(e) => set("courseId", e.target.value)} style={selectStyle}>
          <option value="">Pick a course…</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} style={inputStyle} />
        <input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <select value={form.teacherId} onChange={(e) => set("teacherId", e.target.value)} style={selectStyle} disabled={!form.courseId}>
          <option value="">{teachersForCourse.length > 0 ? "Default educator" : "No educator assigned yet"}</option>
          {teachersForCourse.map((l) => (
            <option key={l.teacherId} value={l.teacherId}>{l.teacher.firstName} {l.teacher.lastName}{l.isPrimary ? " (Primary)" : ""}</option>
          ))}
        </select>
        <input type="text" placeholder="Room (optional)" value={form.room} onChange={(e) => set("room", e.target.value)} style={inputStyle} />
      </div>

      {isCreating && (
        <ClassMultiPicker
          siblings={siblingClasses}
          selectedIds={applyToClassIds}
          onChange={setApplyToClassIds}
          label={`Also add to other ${siblingClasses[0]?.gradeName || "grade"} classes`}
        />
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ padding: "8px 16px", backgroundColor: "#fff", color: T.inkMuted, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={isSaving || !form.courseId || !form.startTime || !form.endTime} style={{ padding: "8px 18px", backgroundColor: isSaving ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isSaving ? "not-allowed" : "pointer" }}>
          {isSaving ? "Saving…" : applyToClassIds.length > 0 ? `Save Slot (${applyToClassIds.length + 1} classes)` : "Save Slot"}
        </button>
      </div>
    </div>
  );
}

function DaySlotRow({ slot, teacherLabel, courseName, onEdit, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, minWidth: 130 }}>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</span>
      <div style={{ flex: 1, minWidth: 140 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{courseName}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>{teacherLabel}{slot.room ? ` · ${slot.room}` : ""}</p>
      </div>
      <button type="button" onClick={onEdit} style={{ padding: "5px 10px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        Edit
      </button>
      <button type="button" onClick={onDelete} style={{ padding: "5px 10px", backgroundColor: "#FEF2F2", color: "#B91C1C", border: "1.5px solid #FECACA", borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        Remove
      </button>
    </div>
  );
}

// A date not covered by any curriculum period, or covered but inside that period's break, isn't
// wrong to anchor on — the calendar engine already skips forward to the next valid schedulable
// day on its own (see isDateSchedulable/resolveCoursePlacements in timetable.service.js) — this
// is purely a clarity signal so the school isn't left wondering why Session 1 didn't land where
// they expected, and points at exactly where to go to change it. isProgram picks the wording
// (and where to fix it) since a Program's one window comes from its deployment dates, while every
// other curriculum's terms/breaks come from its published Academic Year.
function describeNonSchedulable(dateStr, periods, isProgram) {
  if (!dateStr || !periods.length) return null;
  const covering = periods.find((p) => p.startDate && p.endDate && dateStr >= p.startDate && dateStr <= p.endDate);
  if (covering) {
    if (covering.breakStartDate && covering.breakEndDate && dateStr >= covering.breakStartDate && dateStr <= covering.breakEndDate) {
      return `Falls inside ${covering.name || "a"} break (${fmtShort(covering.breakStartDate)} – ${fmtShort(covering.breakEndDate)}) — Session 1 will automatically land on the next open day after it. No action needed, unless the break dates themselves are wrong — fix those in ${isProgram ? "Programs" : "Academic Year"}.`;
    }
    return null;
  }
  if (isProgram) {
    const { startDate, endDate } = periods[0];
    return `Falls outside this program's run (${fmtShort(startDate)} – ${fmtShort(endDate)}) — pick a date in that range, or change the run's dates from Programs.`;
  }
  return "Falls outside any configured term — pick a date covered by a published Academic Year term, or go to Academic Year to add/extend one.";
}

// A course's Sessions only start landing on the calendar once its start date is set — this row
// is how a school anchors "Session 1 lines up with this date" for a course that already has
// weekday slots configured above.
function CourseStartDateRow({ courseName, startDate, onSave, isSaving, siblingClasses = [], periods = [], isProgram = false }) {
  const [value, setValue] = useState(startDate || "");
  const [applyToClassIds, setApplyToClassIds] = useState([]);
  useEffect(() => setValue(startDate || ""), [startDate]);
  const dirty = value !== (startDate || "");
  const hint = describeNonSchedulable(value, periods, isProgram);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink, flex: 1, minWidth: 140 }}>{courseName}</p>
        <input type="date" value={value} onChange={(e) => setValue(e.target.value)} style={{ ...inputStyle, padding: "6px 8px" }} />
        <button
          type="button"
          onClick={() => onSave(value, applyToClassIds)}
          disabled={!value || (!dirty && applyToClassIds.length === 0) || isSaving}
          style={{
            padding: "6px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif",
            border: "none", cursor: !value || (!dirty && applyToClassIds.length === 0) || isSaving ? "not-allowed" : "pointer",
            backgroundColor: !value || (!dirty && applyToClassIds.length === 0) || isSaving ? "#b8d9ee" : T.accent, color: "#fff",
          }}
        >
          {isSaving ? "Saving…" : startDate ? "Update" : "Set start date"}{applyToClassIds.length > 0 ? ` (${applyToClassIds.length + 1} classes)` : ""}
        </button>
      </div>
      {hint && <p style={{ margin: 0, fontSize: 11, color: "#B91C1C" }}>{hint}</p>}
      <ClassMultiPicker
        siblings={siblingClasses}
        selectedIds={applyToClassIds}
        onChange={setApplyToClassIds}
        label={`Also set for other ${siblingClasses[0]?.gradeName || "grade"} classes`}
      />
    </div>
  );
}

export default function TimetablePage() {
  const { user } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [addingDay, setAddingDay] = useState(null);
  const [editingSlotId, setEditingSlotId] = useState(null);
  // "class" = the existing single-class editor + calendar below; "all" = a merged, read-only
  // calendar across every class at this hub (slot/start-date editing stays class-scoped, since
  // both inherently apply to one class at a time).
  const [viewMode, setViewMode] = useState("class");

  const { data: schoolsData, isLoading: schoolLoading } = useQuery({
    queryKey: ["schools", "byEmail", user?.email],
    queryFn: () => schoolApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const school = schoolsData?.data?.[0] || null;

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", school?.id, ""],
    queryFn: () => classApi.getAll({ schoolId: school.id }),
    enabled: !!school?.id,
  });
  const classes = (classesData?.data || []).slice().sort((a, b) => a.gradeName.localeCompare(b.gradeName));

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) setSelectedClassId(classes[0].id);
  }, [classes, selectedClassId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId) || null;

  // Other classes at this hub that are guaranteed to share the same course list (same grade +
  // same curriculum) as the one currently being viewed — the only classes it's ever safe to
  // bulk-apply a slot or start date to without risking a course that doesn't exist for them.
  const siblingClasses = classes
    .filter((c) => c.id !== selectedClassId && c.gradeId === selectedClass?.gradeId && c.curriculumId === selectedClass?.curriculumId)
    .map((c) => ({ id: c.id, label: c.streamName || c.gradeName, gradeName: c.gradeName }));
  // Classes with no streamName set all fall back to the same bare gradeName — number the
  // duplicates (e.g. "Bootcamp Cohort A (2)") so the picker's pills are never indistinguishable.
  const labelSeen = {};
  const labelTotals = {};
  siblingClasses.forEach((s) => { labelTotals[s.label] = (labelTotals[s.label] || 0) + 1; });
  siblingClasses.forEach((s) => {
    if (labelTotals[s.label] > 1) {
      labelSeen[s.label] = (labelSeen[s.label] || 0) + 1;
      s.label = `${s.label} (${labelSeen[s.label]})`;
    }
  });

  const { data: courses = [] } = useCurriculumCurrentCourses(selectedClass?.curriculumId, selectedClass?.gradeId);
  const { data: selectedCurriculum } = useCurriculumQuery(selectedClass?.curriculumId);

  // A Program curriculum has no dated periods of its own (Academic Year setup is hidden for
  // it — see CurriculumViewPage) — it runs on the fixed startDate/endDate of its Program
  // deployment instead. Every other curriculum's real term/break dates live on whichever Academic
  // Year version is currently published for it — curriculum.periods itself only ever holds period
  // *names*, never dates (see getPeriodsForClass in timetable.service.js for the server-side
  // mirror of both these sources — this must agree with it or the hint below would lie about what
  // the server is actually going to schedule).
  const isProgram = !!selectedCurriculum?.isProgram;
  const { data: curriculumPrograms = [] } = useProgramsByCurriculumQuery(isProgram ? selectedClass?.curriculumId : undefined);
  const { data: ayData } = useAcademicYears(!isProgram && selectedCurriculum ? selectedClass?.curriculumId : undefined);
  const deployedProgram = isProgram
    ? curriculumPrograms.find((p) => (p.classes || []).some((c) => c.id === selectedClassId))
    : null;
  const periods = deployedProgram
    ? [{ name: selectedCurriculum.name, startDate: deployedProgram.startDate, endDate: deployedProgram.endDate, breakStartDate: "", breakEndDate: "" }]
    : ayData?.publishedVersion?.periods || [];
  const { data: courseLinks = [] } = useClassCourseTeachers(selectedClassId);
  const { data: slotsData, isLoading: slotsLoading } = useClassTimetable(selectedClassId);
  const slots = slotsData?.data || [];

  // Once a class's weekly pattern is already configured, the day-by-day editor collapses down to
  // a summary by default — nothing left to set up, no reason to take up the page. A class with no
  // slots yet (or one just switched to) opens straight into the editor since there's actually
  // something to do. Re-derives on every class switch once that class's slots have loaded, but not
  // on every add/edit refetch within the same class (isLoading only flips on the first fetch).
  const [slotsExpanded, setSlotsExpanded] = useState(false);
  useEffect(() => {
    if (!slotsLoading) setSlotsExpanded(slots.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, slotsLoading]);

  const { mutate: createSlot, isPending: creating } = useCreateSlot(selectedClassId);
  const { mutate: createSlotsBulk, isPending: creatingBulk } = useCreateSlotsBulk();
  const { mutate: updateSlot, isPending: updating } = useUpdateSlot(selectedClassId);
  const { mutate: deleteSlot } = useDeleteSlot(selectedClassId);

  const { data: schedules = [] } = useCourseSchedules(selectedClassId);
  const { mutate: saveCourseSchedule, isPending: savingSchedule } = useSetCourseSchedule(selectedClassId);
  const { mutate: saveCourseScheduleBulk, isPending: savingScheduleBulk } = useSetCourseScheduleBulk();
  const startDateByCourseId = new Map(schedules.map((s) => [s.courseId, s.startDate]));
  const courseIdsWithSlots = [...new Set(slots.map((s) => s.courseId))];

  const [calendarRange, setCalendarRange] = useState(null);
  const onRangeChange = useCallback((r) => setCalendarRange(r), []);
  const { data: classCalendarData, isLoading: classCalendarLoading } = useClassCalendar(
    viewMode === "class" ? selectedClassId : undefined, calendarRange?.from, calendarRange?.to
  );
  const { data: hubCalendarData, isLoading: hubCalendarLoading } = useHubCalendar(
    viewMode === "all" ? school?.id : undefined, calendarRange?.from, calendarRange?.to
  );
  const calendarData = viewMode === "all" ? hubCalendarData : classCalendarData;
  const calendarLoading = viewMode === "all" ? hubCalendarLoading : classCalendarLoading;
  const calendarEvents = calendarData?.data || [];
  const calendarBreaks = calendarData?.breaks || [];
  // Only needed in "All Classes" mode, to label each merged event/break with which class it
  // belongs to — resolveTeacherLabel doubles as the class label here too (same trade-off
  // teacher-portal's own merged calendar already makes: showing which class beats showing
  // nothing, and a per-class course-teacher-link lookup across every class at once isn't
  // available without fetching each class's links individually).
  const classNameById = new Map(classes.map((c) => [c.id, `${c.gradeName}${c.streamName ? ` — ${c.streamName}` : ""}`]));

  // Course names across every grade at the hub, for "All Classes" mode — mirrors teacher-portal's
  // own merged calendar (useCurriculumCoursesByGrade). Program-deployed classes on a different
  // curriculum than the hub's own aren't covered by this lookup; they just fall back to "Course"
  // below, same tolerance every other unresolved-name spot in this file already has.
  const allGradeIds = [...new Set(classes.map((c) => c.gradeId))];
  const { data: hubCoursesByGrade } = useCurriculumCoursesByGrade(viewMode === "all" ? school?.curriculumId : undefined, allGradeIds);
  const resolveHubCourseName = (courseId) => {
    for (const gradeId of allGradeIds) {
      const found = hubCoursesByGrade?.get(gradeId)?.find((c) => c.id === courseId);
      if (found) return found.name;
    }
    return "Course";
  };

  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));
  const slotsByDay = DAYS_OF_WEEK.map((day) => ({
    day,
    slots: slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));
  const daysCovered = new Set(slots.map((s) => s.dayOfWeek)).size;
  const handleCreate = ({ applyToClassIds = [], ...data }) => {
    if (applyToClassIds.length === 0) {
      createSlot({ ...data, classId: selectedClassId }, { onSuccess: () => setAddingDay(null) });
      return;
    }
    // Sibling slots always auto-resolve their educator (teacherId: null) rather than inheriting
    // whichever specific override was picked for the primary class — that teacher may not even
    // teach the sibling class, and reusing their id verbatim would just trip the same-teacher
    // overlap conflict check for no reason.
    const payloads = [
      { ...data, classId: selectedClassId },
      ...applyToClassIds.map((classId) => ({ ...data, classId, teacherId: null })),
    ];
    createSlotsBulk(payloads, { onSuccess: () => setAddingDay(null) });
  };
  const handleUpdate = (data) => {
    updateSlot({ id: editingSlotId, data }, { onSuccess: () => setEditingSlotId(null) });
  };
  const handleSaveCourseSchedule = (courseId, startDate, applyToClassIds = []) => {
    if (applyToClassIds.length === 0) {
      saveCourseSchedule({ classId: selectedClassId, courseId, startDate });
      return;
    }
    const payloads = [
      { classId: selectedClassId, courseId, startDate },
      ...applyToClassIds.map((classId) => ({ classId, courseId, startDate })),
    ];
    saveCourseScheduleBulk(payloads);
  };

  if (schoolLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!school) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px", fontFamily: "Inter, sans-serif" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No hub profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask an admin to link this login to a Learning Hub.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Timetable</h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>
          A weekly schedule for each class — set a day, time, course and educator once; it repeats every week.
        </p>
      </div>

      {classesLoading ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading classes…</div>
      ) : classes.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No classes yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Create a class first, then build its timetable here.</p>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.inkMuted }}>Viewing</label>
            <select
              value={viewMode === "all" ? "__all__" : selectedClassId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__all__") {
                  setViewMode("all");
                } else {
                  setViewMode("class");
                  setSelectedClassId(val);
                }
                setAddingDay(null);
                setEditingSlotId(null);
              }}
              style={{ ...selectStyle, minWidth: 220 }}
            >
              <option value="__all__">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.gradeName}{c.streamName ? ` — ${c.streamName}` : ""}</option>)}
            </select>
          </div>

          {viewMode === "class" && (
          <>
          <div
            style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer" }}
            onClick={() => setSlotsExpanded((v) => !v)}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>Weekly Timetable</p>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkMuted }}>
                {slotsLoading
                  ? "Loading…"
                  : slots.length === 0
                  ? "No slots configured yet"
                  : `${slots.length} slot${slots.length === 1 ? "" : "s"} across ${daysCovered} day${daysCovered === 1 ? "" : "s"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSlotsExpanded((v) => !v); }}
              style={{ padding: "6px 14px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0 }}
            >
              {slotsExpanded ? "Hide" : "Edit"}
            </button>
          </div>

          {slotsExpanded && (slotsLoading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading timetable…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {slotsByDay.map(({ day, slots: daySlots }) => (
                <div key={day} style={{ ...cardStyle, overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>{DAY_LABELS[day]}</p>
                    {addingDay !== day && (
                      <button type="button" onClick={() => { setAddingDay(day); setEditingSlotId(null); }} style={{ padding: "6px 14px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                        + Add Slot
                      </button>
                    )}
                  </div>
                  <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {daySlots.length === 0 && addingDay !== day && (
                      <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint, fontStyle: "italic" }}>No slots scheduled</p>
                    )}
                    {daySlots.map((slot) => (
                      editingSlotId === slot.id ? (
                        <SlotForm
                          key={slot.id}
                          courses={courses}
                          courseLinks={courseLinks}
                          initial={{ courseId: slot.courseId, teacherId: slot.teacherId || "", dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, room: slot.room || "" }}
                          onSubmit={handleUpdate}
                          onCancel={() => setEditingSlotId(null)}
                          isSaving={updating}
                        />
                      ) : (
                        <DaySlotRow
                          key={slot.id}
                          slot={slot}
                          courseName={courseNameById.get(slot.courseId) || "Course"}
                          teacherLabel={resolveTeacherLabel(slot, courseLinks)}
                          onEdit={() => { setEditingSlotId(slot.id); setAddingDay(null); }}
                          onDelete={() => deleteSlot(slot.id)}
                        />
                      )
                    ))}
                    {addingDay === day && (
                      <SlotForm
                        courses={courses}
                        courseLinks={courseLinks}
                        lockedDay={day}
                        onSubmit={handleCreate}
                        onCancel={() => setAddingDay(null)}
                        isSaving={creating || creatingBulk}
                        siblingClasses={siblingClasses}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {!slotsLoading && courseIdsWithSlots.length > 0 && (
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}` }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>Course Start Dates</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkMuted }}>Anchors each course's Session 1 to a real date so it can appear on the calendar below.</p>
              </div>
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                {courseIdsWithSlots.map((courseId) => (
                  <CourseStartDateRow
                    key={courseId}
                    courseName={courseNameById.get(courseId) || "Course"}
                    startDate={startDateByCourseId.get(courseId)}
                    isSaving={savingSchedule || savingScheduleBulk}
                    siblingClasses={siblingClasses}
                    periods={periods}
                    isProgram={isProgram}
                    onSave={(startDate, applyToClassIds) => handleSaveCourseSchedule(courseId, startDate, applyToClassIds)}
                  />
                ))}
              </div>
            </div>
          )}
          </>
          )}

          {viewMode === "class" ? (
            !slotsLoading && (
              <CalendarView
                events={calendarEvents}
                breaks={calendarBreaks}
                isLoading={calendarLoading}
                resolveCourseName={(courseId) => courseNameById.get(courseId) || "Course"}
                resolveTeacherLabel={(event) => resolveTeacherLabel(event, courseLinks)}
                onRangeChange={onRangeChange}
                emptyMessage={courseIdsWithSlots.length === 0 ? "Add weekday slots above to start building this class's calendar." : "No sessions land in this range yet — set a course start date above."}
                enableSessionDetail
              />
            )
          ) : (
            <CalendarView
              events={calendarEvents}
              breaks={calendarBreaks}
              isLoading={calendarLoading}
              resolveCourseName={resolveHubCourseName}
              resolveTeacherLabel={(event) => classNameById.get(event.classId) || "Class"}
              resolveClassLabel={(classId) => classNameById.get(classId)}
              onRangeChange={onRangeChange}
              emptyMessage="No sessions land in this range across any class yet."
              enableSessionDetail
            />
          )}
        </>
      )}
    </div>
  );
}
