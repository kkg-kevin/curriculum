import api from "../../../services/api";

const ENDPOINT = "/api/assessments";

export const assessmentApi = {
  create: (data) => api.post(ENDPOINT, data).then((r) => r.data.data),
  getAll: (params) => api.get(ENDPOINT, { params }).then((r) => r.data),
  getById: (id) => api.get(`${ENDPOINT}/${id}`).then((r) => r.data.data),
  update: (id, data) => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),

  /* Competencies — this assessment's tagged competencies (authored globally in Settings) */
  getAssessmentCompetencies: (assessmentId) =>
    api.get(`${ENDPOINT}/${assessmentId}/competencies/links`).then((r) => r.data.data),

  linkCompetency: (assessmentId, competencyId) =>
    api.post(`${ENDPOINT}/${assessmentId}/competencies/links`, { competencyId }).then((r) => r.data.data),

  unlinkCompetency: (assessmentId, competencyId) =>
    api.delete(`${ENDPOINT}/${assessmentId}/competencies/links/${competencyId}`).then((r) => r.data.data),

  /* Learning Areas — this assessment's tagged learning areas (authored globally in Settings) */
  getAssessmentLearningAreas: (assessmentId) =>
    api.get(`${ENDPOINT}/${assessmentId}/learning-areas/links`).then((r) => r.data.data),

  linkLearningArea: (assessmentId, learningAreaId) =>
    api.post(`${ENDPOINT}/${assessmentId}/learning-areas/links`, { learningAreaId }).then((r) => r.data.data),

  unlinkLearningArea: (assessmentId, learningAreaId) =>
    api.delete(`${ENDPOINT}/${assessmentId}/learning-areas/links/${learningAreaId}`).then((r) => r.data.data),
};
