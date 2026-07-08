import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
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
