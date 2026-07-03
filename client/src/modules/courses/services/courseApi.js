import api from "../../../services/api";

const ENDPOINT = "/api/courses";

export const courseApi = {
  create: (data) => api.post(ENDPOINT, data).then((r) => r.data.data),
  getAll: (params) => api.get(ENDPOINT, { params }).then((r) => r.data),
  getById: (id) => api.get(`${ENDPOINT}/${id}`).then((r) => r.data.data),
  update: (id, data) => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),

  /* Competencies — this course's tagged competencies (authored globally in Settings) */
  getCourseCompetencies: (courseId) =>
    api.get(`${ENDPOINT}/${courseId}/competencies/links`).then((r) => r.data.data),

  linkCompetency: (courseId, competencyId) =>
    api.post(`${ENDPOINT}/${courseId}/competencies/links`, { competencyId }).then((r) => r.data.data),

  unlinkCompetency: (courseId, competencyId) =>
    api.delete(`${ENDPOINT}/${courseId}/competencies/links/${competencyId}`).then((r) => r.data.data),

  /* Sessions */
  getSessions: (courseId) =>
    api.get(`${ENDPOINT}/${courseId}/sessions`).then((r) => r.data.data),

  createSession: (courseId, data) =>
    api.post(`${ENDPOINT}/${courseId}/sessions`, data).then((r) => r.data.data),

  createSessionsBulk: (courseId, count) =>
    api.post(`${ENDPOINT}/${courseId}/sessions/bulk`, { count }).then((r) => r.data.data),

  updateSession: (courseId, sessionId, data) =>
    api.put(`${ENDPOINT}/${courseId}/sessions/${sessionId}`, data).then((r) => r.data.data),

  deleteSession: (courseId, sessionId) =>
    api.delete(`${ENDPOINT}/${courseId}/sessions/${sessionId}`).then((r) => r.data),
};
