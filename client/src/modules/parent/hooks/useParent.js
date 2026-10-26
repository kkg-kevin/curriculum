import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { parentApi } from "../services/parentApi";

// Every parent-portal query lives under ["parent", …] — ParentChildLayout clears the
// learner-portal caches when the parent moves between children, and keeps these.
export const PARENT_KEYS = {
  overview: ["parent", "overview"],
  timetable: (from, to) => ["parent", "timetable", from, to],
  login: (childId) => ["parent", "login", childId],
};

export function useParentOverview() {
  return useQuery({ queryKey: PARENT_KEYS.overview, queryFn: parentApi.overview, staleTime: 60 * 1000 });
}

export function useParentTimetable(from, to) {
  return useQuery({ queryKey: PARENT_KEYS.timetable(from, to), queryFn: () => parentApi.timetable(from, to), enabled: !!from && !!to });
}

export function useChildLogin(childId) {
  return useQuery({ queryKey: PARENT_KEYS.login(childId), queryFn: () => parentApi.childLogin(childId), enabled: !!childId });
}

export function useSetChildLogin(childId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => parentApi.setChildLogin(childId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PARENT_KEYS.login(childId) });
      qc.invalidateQueries({ queryKey: PARENT_KEYS.overview });
      toast.success("Login saved");
    },
    onError: (err) => toast.error(err.message || "Could not save the login"),
  });
}
