import api from "../../../services/api";

const ENDPOINT = "/api/curricula";

export const curriculumApi = {
  create: (data) => api.post(ENDPOINT, data).then((r) => r.data.data),
  getAll: (params) => api.get(ENDPOINT, { params }).then((r) => r.data),
  getById: (id) => api.get(`${ENDPOINT}/${id}`).then((r) => r.data.data),
  // For a "curriculumAdmin" account — their own assigned curriculum, resolved server-side off
  // the caller's own record rather than a client-supplied id.
  getMine: () => api.get(`${ENDPOINT}/mine`).then((r) => r.data.data),
  update: (id, data) => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),

  /* Courses — added to this curriculum from here (a course stays independent otherwise) */
  getCurriculumCourses: (id) =>
    api.get(`${ENDPOINT}/${id}/courses/links`).then((r) => r.data.data),

  linkCourse: (id, courseId) =>
    api.post(`${ENDPOINT}/${id}/courses/links`, { courseId }).then((r) => r.data.data),

  unlinkCourse: (id, courseId) =>
    api.delete(`${ENDPOINT}/${id}/courses/links/${courseId}`).then((r) => r.data.data),

  /* Curriculum admin — the one account delegated to manage this specific curriculum
     (admin-only; the assigned admin's info comes back as curriculum.curriculumAdmin on the
     normal getById/getAll reads, not a separate endpoint) */
  assignAdmin: (id, data) => api.post(`${ENDPOINT}/${id}/admin`, data).then((r) => r.data.data),
  unassignAdmin: (id) => api.delete(`${ENDPOINT}/${id}/admin`).then((r) => r.data.data),
};
