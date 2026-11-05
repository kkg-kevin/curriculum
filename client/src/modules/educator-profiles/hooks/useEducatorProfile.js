import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { educatorProfileApi } from "../services/educatorProfileApi";

const KEY = ["educator-profile"];
const errorText = (err, fallback) => err?.errors?.[0]?.message || err?.message || fallback;

export const useEducatorProfile = (teacherId, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, teacherId], queryFn: () => educatorProfileApi.get(teacherId), enabled: enabled && !!teacherId, staleTime: 60 * 1000 });
export const useMyEducatorProfile = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "me"], queryFn: () => educatorProfileApi.mine(), enabled });
export const useMentorDirectory = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "directory"], queryFn: educatorProfileApi.directory, enabled, staleTime: 5 * 60 * 1000 });
export const usePublicEducatorProfile = (slug) => useQuery({ queryKey: [...KEY, "public", slug], queryFn: () => educatorProfileApi.publicProfile(slug), enabled: !!slug, retry: false });

// Recount an educator's figures now (they refresh nightly and every 6 hours anyway).
export function useRefreshEducatorProfile(teacherId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => (teacherId ? educatorProfileApi.get(teacherId, { fresh: true }) : educatorProfileApi.mine({ fresh: true })),
    onSuccess: (fresh) => { qc.setQueryData([...KEY, teacherId || "me"], fresh); toast.success("Figures brought up to date"); },
    onError: (err) => toast.error(errorText(err, "Couldn't refresh the figures")),
  });
}

export function useSaveMyEducatorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: educatorProfileApi.saveMine,
    onSuccess: (profile) => {
      qc.setQueryData([...KEY, "me"], profile);
      toast.success(profile.publish.state === "private" ? "Saved — your profile is private" : profile.publish.state === "published" ? "Saved" : "Saved — an admin will check it before it goes public");
    },
    onError: (err) => toast.error(errorText(err, "Couldn't save your profile")),
  });
}

export function useReviewEducatorProfile(teacherId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => educatorProfileApi.review(teacherId, body),
    onSuccess: (profile, { action }) => {
      qc.setQueryData([...KEY, teacherId], profile);
      toast.success({ approve: "Profile published", send_back: "Sent back with your note", unpublish: "Profile taken down" }[action]);
    },
    onError: (err) => toast.error(errorText(err, "Couldn't update the profile")),
  });
}

export function useHandleMentorRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: educatorProfileApi.handleRequest,
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Marked handled"); },
    onError: (err) => toast.error(errorText(err, "Couldn't update the request")),
  });
}

export function useRequestMentor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherId, ...body }) => educatorProfileApi.request(teacherId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Sent — the team will be in touch"); },
    onError: (err) => toast.error(errorText(err, "Couldn't send your request")),
  });
}
