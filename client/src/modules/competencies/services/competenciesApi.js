import api from "../../../services/api";

const base = (curriculumId) => `/api/curricula/${curriculumId}/competencies`;

export const competenciesApi = {
  /* Learning Areas */
  getLearningAreas: (curriculumId) =>
    api.get(`${base(curriculumId)}/learning-areas`).then((r) => r.data.data),

  createLearningArea: (curriculumId, data) =>
    api.post(`${base(curriculumId)}/learning-areas`, data).then((r) => r.data.data),

  updateLearningArea: (curriculumId, aId, data) =>
    api.put(`${base(curriculumId)}/learning-areas/${aId}`, data).then((r) => r.data.data),

  deleteLearningArea: (curriculumId, aId) =>
    api.delete(`${base(curriculumId)}/learning-areas/${aId}`).then((r) => r.data),

  /* Competencies */
  getCompetencies: (curriculumId) =>
    api.get(`${base(curriculumId)}/items`).then((r) => r.data.data),

  createCompetency: (curriculumId, data) =>
    api.post(`${base(curriculumId)}/items`, data).then((r) => r.data.data),

  updateCompetency: (curriculumId, cId, data) =>
    api.put(`${base(curriculumId)}/items/${cId}`, data).then((r) => r.data.data),

  deleteCompetency: (curriculumId, cId) =>
    api.delete(`${base(curriculumId)}/items/${cId}`).then((r) => r.data),

  /* Progression Ladder */
  getLadder: (curriculumId) =>
    api.get(`${base(curriculumId)}/ladder`).then((r) => r.data.data),

  updateLadder: (curriculumId, rungs) =>
    api.put(`${base(curriculumId)}/ladder`, { rungs }).then((r) => r.data.data),
};
