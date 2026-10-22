import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { checkinsApi } from "../services/checkinsApi";

// Every change in check-ins can move several lists at once (a submitted report changes My
// Check-ins, the overview and the actions), so each mutation refreshes the whole "checkins" cache.
const KEY = ["checkins"];
const errorText = (err) => err?.errors?.[0]?.message || err?.message || "Something went wrong";

export const useCheckinPeople = () => useQuery({ queryKey: [...KEY, "people"], queryFn: checkinsApi.people, staleTime: 60 * 1000 });
export const useCheckinHubs = () => useQuery({ queryKey: [...KEY, "hubs"], queryFn: checkinsApi.hubs, staleTime: 60 * 1000 });
export const useCheckinOverview = (params, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "overview", params], queryFn: () => checkinsApi.overview(params), enabled, placeholderData: keepPreviousData });
export const useCheckinSchedules = (params, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "schedules", params], queryFn: () => checkinsApi.schedules(params), enabled });
export const useCheckinSessions = (params) => useQuery({ queryKey: [...KEY, "sessions", params], queryFn: () => checkinsApi.sessions(params), placeholderData: keepPreviousData });
export const useCheckinSession = (id) => useQuery({ queryKey: [...KEY, "session", id], queryFn: () => checkinsApi.session(id), enabled: !!id });
export const useCheckinActions = (params) => useQuery({ queryKey: [...KEY, "actions", params], queryFn: () => checkinsApi.actions(params), placeholderData: keepPreviousData });
export const useCheckinAction = (id) => useQuery({ queryKey: [...KEY, "action", id], queryFn: () => checkinsApi.action(id), enabled: !!id });

export function useCheckinMutation(mutationFn, success) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      const message = typeof success === "function" ? success(result, variables) : success;
      if (message) toast.success(message);
    },
    onError: (err) => toast.error(errorText(err)),
  });
}
