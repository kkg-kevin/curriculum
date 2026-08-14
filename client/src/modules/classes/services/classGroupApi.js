import api from "../../../services/api";

const BASE = "/api/class-groups";

export const classGroupApi = {
  create: (classId, name) => api.post(BASE, { classId, name }).then((r) => r.data.data),
  // Returns { groups, ungroupedLearners } — every group in the class, each with members
  // resolved, plus whichever active learners aren't in any group yet.
  getAll: (classId) => api.get(BASE, { params: { classId } }).then((r) => r.data.data),
  rename: (id, name) => api.patch(`${BASE}/${id}`, { name }).then((r) => r.data.data),
  remove: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),
  addMember: (groupId, learnerId) => api.post(`${BASE}/${groupId}/members`, { learnerId }).then((r) => r.data.data),
  removeMember: (groupId, learnerId) => api.delete(`${BASE}/${groupId}/members/${learnerId}`).then((r) => r.data.data),
  getForLearner: (classId, learnerId) => api.get(`${BASE}/class/${classId}/learner/${learnerId}`).then((r) => r.data.data),
};
