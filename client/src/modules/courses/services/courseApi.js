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

  /* Learning Areas — this course's tagged learning areas (authored globally in Settings) */
  getCourseLearningAreas: (courseId) =>
    api.get(`${ENDPOINT}/${courseId}/learning-areas/links`).then((r) => r.data.data),

  linkLearningArea: (courseId, learningAreaId) =>
    api.post(`${ENDPOINT}/${courseId}/learning-areas/links`, { learningAreaId }).then((r) => r.data.data),

  unlinkLearningArea: (courseId, learningAreaId) =>
    api.delete(`${ENDPOINT}/${courseId}/learning-areas/links/${learningAreaId}`).then((r) => r.data.data),

  /* Curricula — read-only here; a course is added to a curriculum from the curriculum side */
  getCourseCurricula: (courseId) =>
    api.get(`${ENDPOINT}/${courseId}/curricula/links`).then((r) => r.data.data),

  /* Score Evidence — preview how a course-attached assessment's marks narrow down under a linked curriculum */
  getAssessmentScoring: (courseId, assessmentId, curriculumId) =>
    api.get(`${ENDPOINT}/${courseId}/assessments/${assessmentId}/scoring`, { params: { curriculumId } }).then((r) => r.data.data),

  /* Sessions */
  getSessions: (courseId) =>
    api.get(`${ENDPOINT}/${courseId}/sessions`).then((r) => r.data.data),

  createSession: (courseId, data) =>
    api.post(`${ENDPOINT}/${courseId}/sessions`, data).then((r) => r.data.data),

  createSessionsBulk: (courseId, { count, moduleId = null }) =>
    api.post(`${ENDPOINT}/${courseId}/sessions/bulk`, { count, moduleId }).then((r) => r.data.data),

  updateSession: (courseId, sessionId, data) =>
    api.put(`${ENDPOINT}/${courseId}/sessions/${sessionId}`, data).then((r) => r.data.data),

  deleteSession: (courseId, sessionId) =>
    api.delete(`${ENDPOINT}/${courseId}/sessions/${sessionId}`).then((r) => r.data),

  /* Modules */
  getModules: (courseId) =>
    api.get(`${ENDPOINT}/${courseId}/modules`).then((r) => r.data.data),

  createModule: (courseId, data) =>
    api.post(`${ENDPOINT}/${courseId}/modules`, data).then((r) => r.data.data),

  updateModule: (courseId, moduleId, data) =>
    api.put(`${ENDPOINT}/${courseId}/modules/${moduleId}`, data).then((r) => r.data.data),

  deleteModule: (courseId, moduleId) =>
    api.delete(`${ENDPOINT}/${courseId}/modules/${moduleId}`).then((r) => r.data),
};
