import api from "../../../services/api";

const BASE = "/api/learning-hubs";

export const learningHubApi = {
  create:  (data)     => api.post(BASE, data).then((r) => r.data.data),
  getAll:  (params)   => api.get(BASE, { params }).then((r) => r.data),
  getById: (id)        => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  getCurricula: (id)   => api.get(`${BASE}/${id}/curricula`).then((r) => r.data.data),
  attachCurriculum: (id, data) => api.post(`${BASE}/${id}/curricula`, data).then((r) => r.data.data),
  updateCurriculumStatus: (id, curriculumId, status) =>
    api.patch(`${BASE}/${id}/curricula/${curriculumId}/status`, { status }).then((r) => r.data.data),
  removeCurriculum: (id, curriculumId) =>
    api.delete(`${BASE}/${id}/curricula/${curriculumId}`).then((r) => r.data.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:  (id)        => api.delete(`${BASE}/${id}`).then((r) => r.data),
  getTeachers: (id)    => api.get(`${BASE}/${id}/teachers/links`).then((r) => r.data.data),
  // A "school" account's own hub plus any branch hubs under it — feeds the school-portal's
  // hub-switcher (see useSchoolPortalScope.js).
  getMine: ()          => api.get(`${BASE}/mine`).then((r) => r.data.data),
};
