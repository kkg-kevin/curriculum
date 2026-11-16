import api from "../../../services/api";

// Moving a learner between programmes — server modules/learner-moves/.
export const learnerMovesApi = {
  options: (learnerId) => api.get(`/api/learner-moves/${learnerId}`).then((r) => r.data.data),
  move: (learnerId, body) => api.post(`/api/learner-moves/${learnerId}/move`, body).then((r) => r.data.data),
  history: (learnerId) => api.get(`/api/learner-moves/${learnerId}/history`).then((r) => r.data.data || []),
};

export const PROGRAMME_LABELS = {
  hub: "Hub class",
  bootcamp: "Bootcamp",
  home_learning: "Home Learning",
  tech_club: "Tech Club",
  pathway: "Pathway plan",
};

export const PERIOD_LABELS = { weekly: "Weekly", monthly: "Monthly", quarterly: "Every 3 months", annually: "Yearly", daily: "Daily" };
