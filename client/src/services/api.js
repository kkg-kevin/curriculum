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
const EDUCATOR_FRAME_REQUESTS = /^\/api\/(teachers|checkins|notifications|auth|tot|qa|claims|uploads)(\/|$|\?)|^\/api\/home-learning\/(educator|my-assignments)/;

api.interceptors.request.use((config) => {
  const learnerId = getActiveLearnerId();
  if (learnerId) config.headers["X-Active-Learner-Id"] = learnerId;
  const hubId = getActiveHubId();
  if (hubId) config.headers["X-Active-Hub-Id"] = hubId;
  // An educator's own learning (training of trainers): requests from the teacher portal's "My
  // learning" run as their own learner record (scope.middleware.js) — except what the teacher
  // portal's own frame keeps loading around it (the educator record, check-ins, notifications…),
  // which stays the educator's.
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/teacher-portal/learning")
    && !EDUCATOR_FRAME_REQUESTS.test(config.url || "")) {
    config.headers["X-Teacher-Learning"] = "1";
  }
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
    // Machine-readable discriminator (e.g. "ACCOUNT_SUSPENDED") + its reason — set by the
    // server only for specific app errors; undefined for everything else. A suspended user
    // keeps a read-only session, so writes come back with this code — callers just surface it
    // as a normal error; the router already has them locked to the suspended page.
    wrapped.code = error.response?.data?.code;
    wrapped.reason = error.response?.data?.reason;
    // A delete refused because the record is still in use: what uses it. InUseNotice (App.jsx)
    // shows it, so every delete in the app gets the same warning even where its dialog didn't ask
    // first (checkDelete below).
    wrapped.usage = error.response?.data?.usage;
    if (wrapped.code === "IN_USE" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app:in-use", { detail: { message, usage: wrapped.usage } }));
    }

    // The server ended this session (idle too long, or signed out elsewhere) — tell AuthContext,
    // which signs this tab out and sends it to the login page, whichever request noticed first.
    if (wrapped.statusCode === 401 && wrapped.code === "SESSION_EXPIRED" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    }

    return Promise.reject(wrapped);
  }
);

// "Is this still in use?" — the same DELETE with ?check, which only answers (the server's
// modules/usage): { inUse, usages: [{ label, count, examples }], alternative }. Delete dialogs ask
// this before anyone confirms (ConfirmDialog's usageCheck).
export const checkDelete = (url) => api.delete(url, { params: { check: 1 } }).then((r) => r.data.data);

export default api;
