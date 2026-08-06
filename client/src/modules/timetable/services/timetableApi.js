import api from "../../../services/api";

const BASE = "/api/timetable";

export const timetableApi = {
  listByClass: (classId)     => api.get(BASE, { params: { classId } }).then((r) => r.data),
  create:      (data)        => api.post(BASE, data).then((r) => r.data.data),
  update:      (id, data)    => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:      (id)          => api.delete(`${BASE}/${id}`).then((r) => r.data),
  getMyTeacherTimetable: ()  => api.get(`${BASE}/teacher/mine`).then((r) => r.data),
  getMyLearnerTimetable: ()  => api.get(`${BASE}/learner/mine`).then((r) => r.data),

  getCourseSchedules: (classId) => api.get(`${BASE}/course-schedule`, { params: { classId } }).then((r) => r.data.data),
  setCourseSchedule:  (data)    => api.put(`${BASE}/course-schedule`, data).then((r) => r.data.data),

  // Full response body ({data: events, breaks, count}), not just r.data.data — callers need the
  // sibling `breaks` array (curriculum break windows overlapping the range) alongside events.
  getClassCalendar:      (classId, from, to) => api.get(`${BASE}/calendar`, { params: { classId, from, to } }).then((r) => r.data),
  getHubCalendar:        (hubId, from, to)   => api.get(`${BASE}/hub/calendar`, { params: { hubId, from, to } }).then((r) => r.data),
  getMyTeacherCalendar:  (from, to)          => api.get(`${BASE}/teacher/mine/calendar`, { params: { from, to } }).then((r) => r.data),
  getMyLearnerCalendar:  (from, to)          => api.get(`${BASE}/learner/mine/calendar`, { params: { from, to } }).then((r) => r.data),

  // Click/hover-through detail for one calendar event: attendance + grading progress for that
  // exact (class, session, date). Teacher/hub level only — see timetable.routes.js.
  getSessionSummary: (sessionId, classId, date) =>
    api.get(`${BASE}/sessions/${sessionId}/summary`, { params: { classId, date } }).then((r) => r.data.data),

  // Lightweight status for every visible event's (classId, sessionId, date) triple, in one call —
  // powers the calendar's at-a-glance badges without a full-detail fetch per card.
  getSessionStatusBulk: (occurrences) =>
    api.post(`${BASE}/sessions/status`, { occurrences }).then((r) => r.data.data),
};
