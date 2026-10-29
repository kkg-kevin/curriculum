import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { qaApi } from "../services/qaApi";

// A change in QA can move several lists at once (sending a report takes a visit out of Due and
// into an educator's reports), so each mutation refreshes the whole "qa" cache.
const KEY = ["qa"];
export const qaErrorText = (err) => err?.errors?.[0]?.message || err?.message || "Something went wrong";

export const useQaTemplates = (params = {}, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "templates", params], queryFn: () => qaApi.templates(params), enabled });
export const useQaTemplate = (id) => useQuery({ queryKey: [...KEY, "template", id], queryFn: () => qaApi.template(id), enabled: !!id });
export const useQaEducators = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "educators"], queryFn: qaApi.educators, staleTime: 30 * 1000, enabled });
export const useQaReviewers = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "reviewers"], queryFn: qaApi.reviewers, staleTime: 60 * 1000, enabled });
export const useQaSchedules = (params) => useQuery({ queryKey: [...KEY, "schedules", params], queryFn: () => qaApi.schedules(params) });
export const useQaVisits = (params, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "visits", params], queryFn: () => qaApi.visits(params), placeholderData: keepPreviousData, enabled });
export const useQaVisit = (id) => useQuery({ queryKey: [...KEY, "visit", id], queryFn: () => qaApi.visit(id), enabled: !!id });

export function useQaMutation(mutationFn, success) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      const message = typeof success === "function" ? success(result, variables) : success;
      if (message) toast.success(message);
    },
    onError: (err) => toast.error(qaErrorText(err)),
  });
}
