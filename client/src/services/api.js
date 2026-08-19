import axios from "axios";
import { getActiveLearnerId } from "../modules/learner-portal/utils/activeLearner";
import { getActiveHubId } from "../modules/school-portal/utils/activeHub";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
  // Without this, a stalled connection (dropped wifi, server restart mid-request) hangs the
  // request's promise forever — any UI gated on it (e.g. the learner-portal's first-login
  // diagnostic gate) would then spin indefinitely instead of failing and letting the caller
  // recover.
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Lets a guardian with more than one linked learner (siblings sharing the same guardianEmail)
// scope every request to whichever child the learner-portal is currently switched to — a no-op
// for every other role, since the server only reads this header when role === "learner"
// (see scope.middleware.js's attachOwnRecords).
// Lets a "school" account whose hub is itself the parent of other hubs (its "branches") scope
// every request to whichever one the school-portal is currently switched to — a no-op for every
// other role, since the server only reads this header when role === "school" (see
// scope.middleware.js's attachOwnRecords).
api.interceptors.request.use((config) => {
  const learnerId = getActiveLearnerId();
  if (learnerId) config.headers["X-Active-Learner-Id"] = learnerId;
  const hubId = getActiveHubId();
  if (hubId) config.headers["X-Active-Hub-Id"] = hubId;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || "Something went wrong";
    const wrapped = new Error(message);
    // Field-level detail (e.g. Zod issues) — dropped otherwise, since only `message` above
    // survives past this point. Callers that want specifics read `err.errors`.
    wrapped.errors = error.response?.data?.errors;
    wrapped.statusCode = error.response?.status;
    return Promise.reject(wrapped);
  }
);

export default api;
