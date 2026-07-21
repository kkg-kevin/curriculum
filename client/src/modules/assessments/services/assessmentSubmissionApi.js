import api from "../../../services/api";

const BASE = "/api/assessment-submissions";

export const assessmentSubmissionApi = {
  issue:              (payload)          => api.post(`${BASE}/issues`, payload).then((r) => r.data.data),
  getIssuesForClass:  (classId)          => api.get(`${BASE}/issues`, { params: { classId } }).then((r) => r.data),
  getRoster:          (issueId)          => api.get(`${BASE}/issues/${issueId}/roster`).then((r) => r.data.data),
  revokeIssue:        (issueId)          => api.delete(`${BASE}/issues/${issueId}`).then((r) => r.data),

  getIssuedForLearner: ()                => api.get(`${BASE}/learner/issued`).then((r) => r.data),
  getOrCreateSubmission: (issueId)       => api.post(`${BASE}/submissions`, { issueId }).then((r) => r.data.data),
  saveDraft:           (id, answers)     => api.patch(`${BASE}/submissions/${id}/draft`, { answers }).then((r) => r.data.data),
  submit:              (id, answers)     => api.post(`${BASE}/submissions/${id}/submit`, { answers }).then((r) => r.data.data),
  getSubmission:       (id)              => api.get(`${BASE}/submissions/${id}`).then((r) => r.data.data),
  grade:               (id, payload)     => api.patch(`${BASE}/submissions/${id}/grade`, payload).then((r) => r.data.data),
};
