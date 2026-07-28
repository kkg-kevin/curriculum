import axios from "axios";
import { getActiveLearnerId } from "../modules/learner-portal/utils/activeLearner";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Lets a guardian with more than one linked learner (siblings sharing the same guardianEmail)
// scope every request to whichever child the learner-portal is currently switched to — a no-op
// for every other role, since the server only reads this header when role === "learner"
// (see scope.middleware.js's attachOwnRecords).
api.interceptors.request.use((config) => {
  const id = getActiveLearnerId();
  if (id) config.headers["X-Active-Learner-Id"] = id;
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
