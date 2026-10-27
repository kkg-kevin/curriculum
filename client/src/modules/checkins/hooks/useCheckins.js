import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { checkinsApi } from "../services/checkinsApi";

// A change in check-ins can move several lists at once (a report takes a check-in out of Due and
// the sign-in pop-up), so each mutation refreshes the whole "checkins" cache.
const KEY = ["checkins"];
const errorText = (err) => err?.errors?.[0]?.message || err?.message || "Something went wrong";

export const useCheckinPeople = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "people"], queryFn: checkinsApi.people, staleTime: 60 * 1000, enabled });
export const useCheckinHubs = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "hubs"], queryFn: checkinsApi.hubs, staleTime: 60 * 1000, enabled });
export const useDueCheckins = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "due"], queryFn: checkinsApi.due, enabled });
export const useCheckinSchedules = (params, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "schedules", params], queryFn: () => checkinsApi.schedules(params), enabled });
export const useCheckinSessions = (params) => useQuery({ queryKey: [...KEY, "sessions", params], queryFn: () => checkinsApi.sessions(params), placeholderData: keepPreviousData });
export const useCheckinTasks = (params) => useQuery({ queryKey: [...KEY, "tasks", params], queryFn: () => checkinsApi.tasks(params), placeholderData: keepPreviousData });
export const useCheckinSession = (id) => useQuery({ queryKey: [...KEY, "session", id], queryFn: () => checkinsApi.session(id), enabled: !!id });

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
