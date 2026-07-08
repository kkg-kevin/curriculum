import api from "../../../services/api";

const ENDPOINT = "/api/curricula";

export const curriculumApi = {
  create: (data) => api.post(ENDPOINT, data).then((r) => r.data.data),
  getAll: (params) => api.get(ENDPOINT, { params }).then((r) => r.data),
  getById: (id) => api.get(`${ENDPOINT}/${id}`).then((r) => r.data.data),
  update: (id, data) => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),

  /* Courses — added to this curriculum from here (a course stays independent otherwise) */
  getCurriculumCourses: (id) =>
    api.get(`${ENDPOINT}/${id}/courses/links`).then((r) => r.data.data),

  linkCourse: (id, courseId) =>
    api.post(`${ENDPOINT}/${id}/courses/links`, { courseId }).then((r) => r.data.data),

  unlinkCourse: (id, courseId) =>
    api.delete(`${ENDPOINT}/${id}/courses/links/${courseId}`).then((r) => r.data.data),
};
