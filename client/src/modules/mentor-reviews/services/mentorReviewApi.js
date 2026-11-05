import api from "../../../services/api";

// Parent feedback on mentors (server: modules/mentor-reviews/).
const BASE = "/api/mentor-reviews";
const data = (r) => r.data.data;

export const mentorReviewApi = {
  // A parent's children (or a TOT learner's own place) with their mentors, and saving a review.
  mine: () => api.get(`${BASE}/mine`).then(data),
  save: (body) => api.put(`${BASE}/mine`, body).then(data),
  // The signed-in educator's own feedback — anonymous, from 3 reviews.
  me: () => api.get(`${BASE}/me`).then(data),
  // An educator's feedback: named (admins, staff, their supervisor) or averages (their hub).
  forEducator: (teacherId) => api.get(`${BASE}/educators/${teacherId}`).then(data),
  setHidden: (id, hidden) => api.patch(`${BASE}/${id}/hidden`, { hidden }).then(data),
  setFeatured: (id, featured) => api.patch(`${BASE}/${id}/featured`, { featured }).then(data),
  resolveConcern: (id) => api.patch(`${BASE}/${id}/concern-resolved`, {}).then(data),
  // Settings → Parent feedback.
  settings: () => api.get(`${BASE}/settings`).then(data),
  saveSettings: (body) => api.put(`${BASE}/settings`, body).then(data),
};
