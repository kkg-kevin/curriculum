import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { errorOf, generalEventsApi } from "../services/generalEventsApi";

export const GENERAL_EVENT_KEYS = {
  all: ["general-events"],
  options: ["general-events", "options"],
  detail: (id) => ["general-events", "detail", id],
  registrations: (id) => ["general-events", "registrations", id],
};

export function useGeneralEventsQuery(options = {}) {
  return useQuery({ queryKey: GENERAL_EVENT_KEYS.all, queryFn: generalEventsApi.list, ...options });
}

export function useGeneralEventOptions() {
  return useQuery({ queryKey: GENERAL_EVENT_KEYS.options, queryFn: generalEventsApi.options, staleTime: 60_000 });
}

export function useGeneralEvent(id) {
  return useQuery({ queryKey: GENERAL_EVENT_KEYS.detail(id), queryFn: () => generalEventsApi.get(id), enabled: !!id });
}

export function useEventRegistrations(id, options = {}) {
  return useQuery({ queryKey: GENERAL_EVENT_KEYS.registrations(id), queryFn: () => generalEventsApi.registrations(id), enabled: !!id, ...options });
}

// A change to an event or its registrations: refresh the event, its list and the events list.
export function useEventMutation(id, fn, success) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: GENERAL_EVENT_KEYS.all });
      if (id) {
        qc.invalidateQueries({ queryKey: GENERAL_EVENT_KEYS.detail(id) });
        qc.invalidateQueries({ queryKey: GENERAL_EVENT_KEYS.registrations(id) });
      }
      const text = typeof success === "function" ? success(result) : success;
      if (text) toast.success(text);
    },
    onError: (err) => toast.error(errorOf(err)),
  });
}
