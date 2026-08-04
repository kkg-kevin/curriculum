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

  getClassCalendar:      (classId, from, to) => api.get(`${BASE}/calendar`, { params: { classId, from, to } }).then((r) => r.data.data),
  getMyTeacherCalendar:  (from, to)          => api.get(`${BASE}/teacher/mine/calendar`, { params: { from, to } }).then((r) => r.data.data),
  getMyLearnerCalendar:  (from, to)          => api.get(`${BASE}/learner/mine/calendar`, { params: { from, to } }).then((r) => r.data.data),
};
