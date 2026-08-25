import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { timetableApi } from "../services/timetableApi";

const TIMETABLE_KEYS = {
  byClass: (classId) => ["timetable", "class", classId],
  mineTeacher: () => ["timetable", "mine", "teacher"],
  mineLearner: () => ["timetable", "mine", "learner"],
  courseSchedules: (classId) => ["timetable", "course-schedule", classId],
  calendar: (classId, from, to) => ["timetable", "calendar", "class", classId, from, to],
  calendarHub: (hubId, from, to) => ["timetable", "calendar", "hub", hubId, from, to],
  calendarMineTeacher: (from, to) => ["timetable", "calendar", "mine", "teacher", from, to],
  calendarMineLearner: (from, to) => ["timetable", "calendar", "mine", "learner", from, to],
  sessionSummary: (sessionId, classId, date) => ["timetable", "session-summary", sessionId, classId, date],
  skips: (classId) => ["timetable", "skips", classId],
};

export function useClassTimetable(classId) {
  return useQuery({
    queryKey: TIMETABLE_KEYS.byClass(classId),
    queryFn:  () => timetableApi.listByClass(classId),
    enabled:  !!classId,
  });
}

export function useMyTeacherTimetable() {
  return useQuery({
    queryKey: TIMETABLE_KEYS.mineTeacher(),
    queryFn:  () => timetableApi.getMyTeacherTimetable(),
  });
}

export function useMyLearnerTimetable() {
  return useQuery({
    queryKey: TIMETABLE_KEYS.mineLearner(),
    queryFn:  () => timetableApi.getMyLearnerTimetable(),
  });
}

export function useCreateSlot(classId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: timetableApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TIMETABLE_KEYS.byClass(classId) });
      toast.success("Timetable slot added");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to add slot"),
  });
}

// Creates the same slot across several classes at once (e.g. every stream of a grade running
// the same course at the same time) — one payload per class, so callers can vary teacherId per
// payload. Uses Promise.allSettled rather than failing the whole batch if one class rejects
// (most likely a scheduling conflict on that one class), and reports how many actually succeeded.
export function useCreateSlotsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payloads) => Promise.allSettled(payloads.map((p) => timetableApi.create(p))),
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (failed === 0) {
        toast.success(results.length > 1 ? `Timetable slot added to ${results.length} classes` : "Timetable slot added");
      } else {
        toast.error(`Added to ${succeeded} of ${results.length} classes — ${failed} failed (likely a scheduling conflict)`);
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to add slot"),
  });
}

export function useUpdateSlot(classId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => timetableApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TIMETABLE_KEYS.byClass(classId) });
      toast.success("Timetable slot updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update slot"),
  });
}

export function useDeleteSlot(classId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: timetableApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TIMETABLE_KEYS.byClass(classId) });
      toast.success("Timetable slot removed");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to remove slot"),
  });
}

export function useCourseSchedules(classId) {
  return useQuery({
    queryKey: TIMETABLE_KEYS.courseSchedules(classId),
    queryFn:  () => timetableApi.getCourseSchedules(classId),
    enabled:  !!classId,
  });
}

export function useSetCourseSchedule(classId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: timetableApi.setCourseSchedule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TIMETABLE_KEYS.courseSchedules(classId) });
      qc.invalidateQueries({ queryKey: ["timetable", "calendar", "class", classId] });
      toast.success("Start date saved");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to save start date"),
  });
}

// Same batching idea as useCreateSlotsBulk, for the start-date anchor — setting a course's start
// date for a class that has no matching slots yet is harmless (TimetableService.resolveCalendar
// just skips it until slots exist), so this doesn't need to validate anything per-class first.
export function useSetCourseScheduleBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payloads) => Promise.allSettled(payloads.map((p) => timetableApi.setCourseSchedule(p))),
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (failed === 0) {
        toast.success(results.length > 1 ? `Start date set for ${results.length} classes` : "Start date saved");
      } else {
        toast.error(`Saved for ${succeeded} of ${results.length} classes — ${failed} failed`);
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to save start date"),
  });
}

// from/to are "YYYY-MM-DD" strings for the currently displayed calendar range (week or month).
export function useClassCalendar(classId, from, to) {
  return useQuery({
    queryKey: TIMETABLE_KEYS.calendar(classId, from, to),
    queryFn:  () => timetableApi.getClassCalendar(classId, from, to),
    enabled:  !!classId && !!from && !!to,
  });
}

// Every class at one Learning Hub, merged onto a single calendar — the school-portal's
// "All Classes" view (same shape as useMyTeacherCalendar/useMyLearnerCalendar below, scoped by
// hub instead of by person).
export function useHubCalendar(hubId, from, to) {
  return useQuery({
    queryKey: TIMETABLE_KEYS.calendarHub(hubId, from, to),
    queryFn:  () => timetableApi.getHubCalendar(hubId, from, to),
    enabled:  !!hubId && !!from && !!to,
  });
}

export function useMyTeacherCalendar(from, to) {
  return useQuery({
    queryKey: TIMETABLE_KEYS.calendarMineTeacher(from, to),
    queryFn:  () => timetableApi.getMyTeacherCalendar(from, to),
    enabled:  !!from && !!to,
  });
}

export function useMyLearnerCalendar(from, to) {
  return useQuery({
    queryKey: TIMETABLE_KEYS.calendarMineLearner(from, to),
    queryFn:  () => timetableApi.getMyLearnerCalendar(from, to),
    enabled:  !!from && !!to,
  });
}

// enabled lets callers gate the request separately from "do we have the ids" — used for the
// hover preview, which should only actually fire after a short hover delay, not on every
// mouseenter (see SessionHoverCard in CalendarView.jsx).
export function useSessionSummary(sessionId, classId, date, enabled = true) {
  return useQuery({
    queryKey: TIMETABLE_KEYS.sessionSummary(sessionId, classId, date),
    queryFn:  () => timetableApi.getSessionSummary(sessionId, classId, date),
    enabled:  !!sessionId && !!classId && !!date && enabled,
    staleTime: 30_000,
  });
}

// Status badges for every event currently on screen, fetched in one batched call keyed off the
// exact set of occurrences shown — refetches when the visible range (and so the event list)
// changes, same as the calendar's own event query.
export function useSessionStatusBulk(occurrences, enabled = true) {
  const key = occurrences.map((o) => `${o.classId}:${o.sessionId}:${o.date}`).sort().join(",");
  return useQuery({
    queryKey: ["timetable", "session-status", key],
    queryFn:  () => timetableApi.getSessionStatusBulk(occurrences),
    enabled:  enabled && occurrences.length > 0,
    staleTime: 30_000,
  });
}

// A class's active reschedules — mainly for SkipDetailModal to resolve which row a clicked
// marker corresponds to; the calendar's own skippedSessions (see useClassCalendar etc.) already
// covers day-to-day display.
export function useClassSkips(classId) {
  return useQuery({
    queryKey: TIMETABLE_KEYS.skips(classId),
    queryFn:  () => timetableApi.getSkipsByClass(classId),
    enabled:  !!classId,
  });
}

// A single skip can ripple into the teacher/learner/hub merged calendars in ways the client
// can't enumerate ahead of time — invalidating the whole ["timetable"] root (TanStack Query
// matches by prefix) is the same broad-invalidation approach useCreateSlotsBulk/
// useSetCourseScheduleBulk above already use for exactly this class of problem.
export function useCreateSkip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: timetableApi.createSkip,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      toast.success("Session rescheduled");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to reschedule session"),
  });
}

// Which of the given candidate teacherIds would conflict (double-booked or outside their own
// declared availability) if picked for this day/time — lets the school-portal's teacher picker
// flag a conflict before save time, same role useRoomAvailability plays for rooms. Only enabled
// once there's at least one candidate and a day + both times are actually picked.
export function useTeacherAvailabilityConflicts({ classId, courseId, teacherIds, dayOfWeek, startTime, endTime, excludeSlotId }) {
  return useQuery({
    queryKey: ["timetable", "teacher-availability-conflicts", classId, courseId, teacherIds, dayOfWeek, startTime, endTime, excludeSlotId],
    queryFn:  () => timetableApi.getTeacherAvailabilityConflicts({ classId, courseId, teacherIds, dayOfWeek, startTime, endTime, excludeSlotId }),
    enabled:  !!classId && !!dayOfWeek && !!startTime && !!endTime && (teacherIds?.length || 0) > 0,
  });
}

export function useDeleteSkip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: timetableApi.removeSkip,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      toast.success("Reschedule undone");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to undo"),
  });
}
