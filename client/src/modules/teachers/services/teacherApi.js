import api from "../../../services/api";

const ENDPOINT = "/api/teachers";

export const teacherApi = {
  create:  (data)       => api.post(ENDPOINT, data).then((r) => r.data.data),
  getAll:  (params)     => api.get(ENDPOINT, { params }).then((r) => r.data),
  getById: (id)         => api.get(`${ENDPOINT}/${id}`).then((r) => r.data.data),
  update:  (id, data)   => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  // Activate / deactivate / on-leave — one-field action, admin or school-for-own-hub.
  updateStatus: (id, status) => api.patch(`${ENDPOINT}/${id}/status`, { status }).then((r) => r.data.data),
  remove:  (id)         => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),
  getHubs:   (id)        => api.get(`${ENDPOINT}/${id}/hubs/links`).then((r) => r.data.data),
  linkHub:   (id, hubId) => api.post(`${ENDPOINT}/${id}/hubs/links`, { hubId }).then((r) => r.data.data),
  unlinkHub: (id, hubId) => api.delete(`${ENDPOINT}/${id}/hubs/links/${hubId}`).then((r) => r.data.data),

  // Weekly "here's when I can teach" windows — see server/src/modules/timetable/
  // timetable.service.js's violatesTeacherAvailability for how these feed into scheduling.
  getAvailability:          (id)             => api.get(`${ENDPOINT}/${id}/availability`).then((r) => r.data.data),
  addAvailabilitySlot:      (id, data)       => api.post(`${ENDPOINT}/${id}/availability`, data).then((r) => r.data.data),
  updateAvailabilitySlot:   (id, slotId, data) => api.put(`${ENDPOINT}/${id}/availability/${slotId}`, data).then((r) => r.data.data),
  removeAvailabilitySlot:   (id, slotId)     => api.delete(`${ENDPOINT}/${id}/availability/${slotId}`).then((r) => r.data),
};
