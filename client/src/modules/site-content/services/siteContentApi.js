import api from "../../../services/api";

const BOOTCAMPS = "/api/site/bootcamps";
const PROJECTS = "/api/site/projects";

// Admin content-authoring for the two public marketing-site listing pages (digifunzi-landing) —
// see server/src/modules/public-site/admin-site.routes.js. Response shape is the standard
// { success, data } / { success, data, count } convention (public-site.controller.js's admin
// CRUD section), same as leadApi/courseApi.
export const siteContentApi = {
  bootcamps: {
    getAll: (params) => api.get(BOOTCAMPS, { params }).then((r) => r.data),
    create: (data) => api.post(BOOTCAMPS, data).then((r) => r.data.data),
    update: (id, data) => api.put(`${BOOTCAMPS}/${id}`, data).then((r) => r.data.data),
    remove: (id) => api.delete(`${BOOTCAMPS}/${id}`).then((r) => r.data),
  },
  projects: {
    getAll: (params) => api.get(PROJECTS, { params }).then((r) => r.data),
    create: (data) => api.post(PROJECTS, data).then((r) => r.data.data),
    update: (id, data) => api.put(`${PROJECTS}/${id}`, data).then((r) => r.data.data),
    remove: (id) => api.delete(`${PROJECTS}/${id}`).then((r) => r.data),
  },
};
