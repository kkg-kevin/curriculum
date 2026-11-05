import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mentorReviewApi } from "../services/mentorReviewApi";

const KEY = ["mentor-reviews"];
const errorText = (err, fallback) => err?.errors?.[0]?.message || err?.message || fallback;

export const useMyMentors = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "mine"], queryFn: mentorReviewApi.mine, enabled, staleTime: 60 * 1000 });
export const useMyFeedback = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "me"], queryFn: mentorReviewApi.me, enabled });
export const useEducatorFeedback = (teacherId, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "educator", teacherId], queryFn: () => mentorReviewApi.forEducator(teacherId), enabled: enabled && !!teacherId });
export const useFeedbackSettings = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "settings"], queryFn: mentorReviewApi.settings, enabled });

export function useSaveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorReviewApi.save,
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Thank you — your review is saved"); },
    onError: (err) => toast.error(errorText(err, "Couldn't save your review")),
  });
}

// Moderation: { id, action: "hide" | "show" | "feature" | "unfeature" | "resolve" }.
export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }) => (
      action === "hide" || action === "show" ? mentorReviewApi.setHidden(id, action === "hide")
        : action === "feature" || action === "unfeature" ? mentorReviewApi.setFeatured(id, action === "feature")
          : mentorReviewApi.resolveConcern(id)),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success({ hide: "Comment hidden", show: "Comment shown again", feature: "On the website", unfeature: "Taken off the website", resolve: "Concern marked resolved" }[action]);
    },
    onError: (err) => toast.error(errorText(err, "Couldn't update the review")),
  });
}

export function useSaveFeedbackSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorReviewApi.saveSettings,
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Parent feedback settings saved"); },
    onError: (err) => toast.error(errorText(err, "Couldn't save the settings")),
  });
}
