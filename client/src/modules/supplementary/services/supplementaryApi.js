import api from "../../../services/api";

const BASE = "/api/supplementary";

export const supplementaryApi = {
  getAll:       (params)        => api.get(BASE, { params }).then((r) => r.data),
  getBySchool:  (schoolId)      => api.get(BASE, { params: { schoolId } }).then((r) => r.data),
  getById:      (id)            => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  create:       (data)          => api.post(BASE, data).then((r) => r.data.data),
  update:       (id, data)      => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:       (id)            => api.delete(`${BASE}/${id}`).then((r) => r.data),
  updateGrades: (id, grades) => api.put(`${BASE}/${id}/grades`, { grades }).then((r) => r.data.data),
};
