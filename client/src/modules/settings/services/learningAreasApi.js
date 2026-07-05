import api from "../../../services/api";

const BASE = "/api/learning-areas";

export const learningAreasApi = {
  getLearningAreas: () =>
    api.get(BASE).then((r) => r.data.data),

  createLearningArea: (data) =>
    api.post(BASE, data).then((r) => r.data.data),

  updateLearningArea: (id, data) =>
    api.put(`${BASE}/${id}`, data).then((r) => r.data.data),

  deleteLearningArea: (id) =>
    api.delete(`${BASE}/${id}`).then((r) => r.data),
};
