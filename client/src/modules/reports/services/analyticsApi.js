import api from "../../../services/api";

// Reports & Analytics tabs (server modules/analytics). `params`: from, to (YYYY-MM-DD), hubId,
// curriculumId, classId, courseId, stageId, pathway, gender — empty ones are left out.
const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null));

export const analyticsApi = {
  filters: (hubId) => api.get("/api/analytics/filters", { params: clean({ hubId }) }).then((r) => r.data.data),
  view: (view, params) => api.get(`/api/analytics/${view}`, { params: clean(params) }).then((r) => r.data.data),
  // Following up a learner at risk: { learnerId, action, note?, message?, reasons? }.
  followup: (body) => api.post("/api/analytics/followups", body).then((r) => r.data.data),
  followupHistory: (learnerId) => api.get(`/api/analytics/followups/${learnerId}`).then((r) => r.data.data),
};
