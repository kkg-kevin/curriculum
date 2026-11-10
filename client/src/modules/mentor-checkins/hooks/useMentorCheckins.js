import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mentorCheckinsApi as A } from "../services/mentorCheckinsApi";

// One cache for the feature: a change (a new time, a report, an approval) moves several lists at
// once, so each mutation refreshes all of it.
export const KEY = ["mentor-checkins"];
export const errorText = (err) => err?.errors?.[0]?.message || err?.message || "Something went wrong";

export const useMentorHubs = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "hubs"], queryFn: A.hubs, staleTime: 60 * 1000, enabled });
export const useHubClasses = (hubId) => useQuery({ queryKey: [...KEY, "hub-classes", hubId], queryFn: () => A.hubClasses(hubId), enabled: !!hubId });
export const useClassPeople = (classId) => useQuery({ queryKey: [...KEY, "class-people", classId], queryFn: () => A.classPeople(classId), enabled: !!classId });
export const useRounds = (params, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "rounds", params], queryFn: () => A.rounds(params), placeholderData: keepPreviousData, enabled });
export const useRound = (id) => useQuery({ queryKey: [...KEY, "round", id], queryFn: () => A.round(id), enabled: !!id });
export const useMeetings = (params, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "meetings", params], queryFn: () => A.meetings(params), placeholderData: keepPreviousData, enabled });
export const useMeeting = (id) => useQuery({ queryKey: [...KEY, "meeting", id], queryFn: () => A.meeting(id), enabled: !!id });
export const useFreeTimes = (id, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "free-times", id], queryFn: () => A.freeTimes(id), enabled: !!id && enabled, staleTime: 0 });
export const useMentorDue = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "due"], queryFn: A.due, enabled });

export function useMentorMutation(mutationFn, success, { toastErrors = true } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      const message = typeof success === "function" ? success(result, variables) : success;
      if (message) toast.success(message);
    },
    onError: (err) => { if (toastErrors) toast.error(errorText(err)); },
  });
}
