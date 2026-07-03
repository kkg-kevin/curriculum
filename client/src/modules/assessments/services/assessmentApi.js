import api from "../../../services/api";

const ENDPOINT = "/api/assessments";

export const assessmentApi = {
  create: (data) => api.post(ENDPOINT, data).then((r) => r.data.data),
  getAll: (params) => api.get(ENDPOINT, { params }).then((r) => r.data),
  getById: (id) => api.get(`${ENDPOINT}/${id}`).then((r) => r.data.data),
  update: (id, data) => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),

  addItem: (assessmentId, data) => api.post(`${ENDPOINT}/${assessmentId}/items`, data).then((r) => r.data.data),
  updateItem: (assessmentId, itemId, data) => api.put(`${ENDPOINT}/${assessmentId}/items/${itemId}`, data).then((r) => r.data.data),
  removeItem: (assessmentId, itemId) => api.delete(`${ENDPOINT}/${assessmentId}/items/${itemId}`).then((r) => r.data),

  addRubricCriterion: (assessmentId, data) => api.post(`${ENDPOINT}/${assessmentId}/rubric`, data).then((r) => r.data.data),
  updateRubricCriterion: (assessmentId, criterionId, data) => api.put(`${ENDPOINT}/${assessmentId}/rubric/${criterionId}`, data).then((r) => r.data.data),
  removeRubricCriterion: (assessmentId, criterionId) => api.delete(`${ENDPOINT}/${assessmentId}/rubric/${criterionId}`).then((r) => r.data),
};
