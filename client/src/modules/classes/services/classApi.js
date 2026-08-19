import api from "../../../services/api";

const BASE = "/api/classes";

export const classApi = {
  create:      (data)       => api.post(BASE, data).then((r) => r.data.data),
  bulkCreate:  (items)      => api.post(`${BASE}/bulk`, items).then((r) => r.data.data),
  getAll:      (params)     => api.get(BASE, { params }).then((r) => r.data),
  getById:     (id)         => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  update:      (id, data)   => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:      (id)         => api.delete(`${BASE}/${id}`).then((r) => r.data),

  // Course-educator assignment — per (class, course) pair, multiple co-equal educators allowed.
  // Replaces the old single classTeacherId field.
  getCourseTeachers:     (classId)                    => api.get(`${BASE}/${classId}/course-teachers`).then((r) => r.data.data),
  assignCourseTeacher:   (classId, courseId, teacherId)   => api.post(`${BASE}/${classId}/course-teachers`, { courseId, teacherId }).then((r) => r.data.data),
  unassignCourseTeacher: (classId, courseId, teacherId)   => api.delete(`${BASE}/${classId}/course-teachers/${courseId}/${teacherId}`).then((r) => r.data),
  setPrimaryCourseTeacher: (classId, courseId, teacherId) => api.patch(`${BASE}/${classId}/course-teachers/${courseId}/${teacherId}/primary`).then((r) => r.data.data),
  // Flat list of every (class, course) link for one teacher, across every class.
  getCourseTeacherLinksForTeacher: (teacherId) => api.get(`${BASE}/course-teacher-links`, { params: { teacherId } }).then((r) => r.data.data),

  // Grade-completion readiness + moving ready learners into the next grade's class.
  getPromotionReadiness: (classId) => api.get(`${BASE}/${classId}/promotion-readiness`).then((r) => r.data.data),
  promoteLearners: (classId, learnerIds) => api.post(`${BASE}/${classId}/promote-learners`, { learnerIds }).then((r) => r.data.data),
};
