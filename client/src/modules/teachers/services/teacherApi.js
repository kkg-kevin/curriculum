import api from "../../../services/api";

const ENDPOINT = "/api/teachers";

export const teacherApi = {
  create:  (data)       => api.post(ENDPOINT, data).then((r) => r.data.data),
  getAll:  (params)     => api.get(ENDPOINT, { params }).then((r) => r.data),
  getById: (id)         => api.get(`${ENDPOINT}/${id}`).then((r) => r.data.data),
  update:  (id, data)   => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  remove:  (id)         => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),
  getHubs:   (id)        => api.get(`${ENDPOINT}/${id}/hubs/links`).then((r) => r.data.data),
  linkHub:   (id, hubId) => api.post(`${ENDPOINT}/${id}/hubs/links`, { hubId }).then((r) => r.data.data),
  unlinkHub: (id, hubId) => api.delete(`${ENDPOINT}/${id}/hubs/links/${hubId}`).then((r) => r.data.data),
};
