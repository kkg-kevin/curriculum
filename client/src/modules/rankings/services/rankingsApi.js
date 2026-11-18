import api from "../../../services/api";

const data = (r) => r.data.data;

// Class rankings and learner analytics (server: modules/rankings/). `mine` / `myAnalytics` are the
// learner's own — on a parent's login, the child chosen in the parent portal (X-Active-Learner-Id).
export const rankingsApi = {
  mine: (classId) => api.get("/api/rankings/me", { params: classId ? { classId } : {} }).then(data),
  // The key things per class (the profile's "This term" strip, the parent home's line per child).
  summary: () => api.get("/api/rankings/me/summary").then(data),
  family: () => api.get("/api/rankings/family").then(data),
  learnerSummary: (learnerId) => api.get(`/api/rankings/learner/${learnerId}/summary`).then(data),
  myAnalytics: (period = "term") => api.get("/api/rankings/me/analytics", { params: { period } }).then(data),
  learnerAnalytics: (learnerId, period = "term") => api.get(`/api/rankings/learner/${learnerId}/analytics`, { params: { period } }).then(data),
  forClass: (classId) => api.get(`/api/rankings/class/${classId}`).then(data),
  settings: () => api.get("/api/rankings/settings").then(data),
  saveSettings: (body) => api.put("/api/rankings/settings", body).then(data),
};

export const formatWeek = (day) => (day ? new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
export const formatMonth = (ym) => (ym ? new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : "");
export const formatDay = (d) => (d ? new Date(String(d).length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const errorOf = (err, fallback = "Something went wrong") => err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || err?.message || fallback;
