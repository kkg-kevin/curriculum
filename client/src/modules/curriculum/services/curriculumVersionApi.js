import api from "../../../services/api";

export const curriculumVersionApi = {
  getAll: (curriculumId) =>
    api.get(`/api/curricula/${curriculumId}/versions`).then((r) => r.data),

  getById: (curriculumId, versionId) =>
    api.get(`/api/curricula/${curriculumId}/versions/${versionId}`).then((r) => r.data),

  create: (curriculumId, body) =>
    api.post(`/api/curricula/${curriculumId}/versions`, body).then((r) => r.data),

  publish: (curriculumId, versionId) =>
    api.post(`/api/curricula/${curriculumId}/versions/${versionId}/publish`).then((r) => r.data),

  revert: (curriculumId, versionId) =>
    api.post(`/api/curricula/${curriculumId}/versions/${versionId}/revert`).then((r) => r.data),
};
