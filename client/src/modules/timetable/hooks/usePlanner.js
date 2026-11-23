import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../../services/api";

// The Timetable Planner's calls (server: timetable-planner.service.js). Everything lives under the
// ["timetable"] cache key, so any change refreshes every calendar too.
const BASE = "/api/timetable";
const data = (r) => r.data.data;
export const errorText = (err) => err?.response?.data?.message || err?.message || "Something went wrong";

export const plannerApi = {
  overview: (hubId) => api.get(`${BASE}/planner`, { params: hubId ? { hubId } : {} }).then(data),
  calendar: (hubId, from, to) => api.get(`${BASE}/planner/calendar`, { params: { ...(hubId ? { hubId } : {}), from, to } }).then((r) => r.data),
  check: (body) => api.post(`${BASE}/planner/check`, body).then(data),
  saveLessons: (body) => api.post(`${BASE}/planner/lessons`, body).then(data),
  updateLesson: (id, body) => api.put(`${BASE}/${id}`, body).then(data),
  removeLesson: (id, params) => api.delete(`${BASE}/${id}`, { params }).then((r) => r.data),
  setStartDate: (body) => api.put(`${BASE}/course-schedule`, body).then(data),
  copyPreview: (body) => api.post(`${BASE}/planner/copy/preview`, body).then(data),
  copyApply: (body) => api.post(`${BASE}/planner/copy/apply`, body).then(data),
};

export const usePlanner = (hubId) => useQuery({
  queryKey: ["timetable", "planner", hubId || "all"],
  queryFn: () => plannerApi.overview(hubId),
  placeholderData: keepPreviousData,
});

export const usePlannerCalendar = (hubId, from, to) => useQuery({
  queryKey: ["timetable", "planner-calendar", hubId || "all", from, to],
  queryFn: () => plannerApi.calendar(hubId, from, to),
  enabled: !!from && !!to,
  placeholderData: keepPreviousData,
});

// Who is busy, who is affected and where the sessions land, for what's in the form right now.
export const usePlannerCheck = (body, enabled) => useQuery({
  queryKey: ["timetable", "planner-check", body],
  queryFn: () => plannerApi.check(body),
  enabled,
  placeholderData: keepPreviousData,
  staleTime: 0,
  retry: false,
});

export function usePlannerMutation(mutationFn, success) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      const message = typeof success === "function" ? success(result, variables) : success;
      if (message) toast.success(message);
    },
    // A start date with sessions already held is a question for the page, not a failure.
    onError: (err) => { if (err.response?.data?.code !== "HAS_HELD_SESSIONS") toast.error(errorText(err)); },
  });
}
