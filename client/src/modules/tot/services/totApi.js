import api from "../../../services/api";

// Training of trainers (server/src/modules/tot/) — educators learning on a curriculum made for
// them, marked by their supervisor.
const BASE = "/api/tot";
const data = (r) => r.data.data;

export const totApi = {
  // The signed-in educator's own training (null when they aren't in training).
  me: () => api.get(`${BASE}/me`).then(data),
  // An educator's training — admin, their supervisor, or a hub they work at.
  educator: (teacherId) => api.get(`${BASE}/educators/${teacherId}`).then(data),
  // The TOT classes (classes of a curriculum for educators) an admin can enrol an educator in.
  classes: () => api.get(`${BASE}/classes`).then(data),
  enrol: (teacherId, body) => api.post(`${BASE}/educators/${teacherId}/enrol`, body).then(data),
  // A course's final report, generated and published (issues the certificate) — supervisor or admin.
  publishCourseReport: (teacherId, body) => api.post(`${BASE}/educators/${teacherId}/course-report`, body).then(data),
  // Ends their training in one TOT class (admin) — nothing deleted.
  withdraw: (teacherId, body) => api.post(`${BASE}/educators/${teacherId}/withdraw`, body).then(data),
  // Work waiting to be marked: a supervisor's educators; an admin's educators with no supervisor (all: every one).
  marking: (params) => api.get(`${BASE}/marking`, { params }).then(data),
};
