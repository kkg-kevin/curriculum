import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { supervisorPortalApi } from "../services/supervisorPortalApi";

const KEY = ["supervisor-portal"];
const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

export const useSupervisorMe = () => useQuery({ queryKey: [...KEY, "me"], queryFn: supervisorPortalApi.me });
export const useSupervisorEducator = (id) => useQuery({ queryKey: [...KEY, "educator", id], queryFn: () => supervisorPortalApi.educator(id), enabled: !!id });

// Their educators' activity, page by page ("Load more").
export const useSupervisorActivity = (params) => useInfiniteQuery({
  queryKey: [...KEY, "activity", params],
  queryFn: ({ pageParam = 1 }) => supervisorPortalApi.activity({ ...params, page: pageParam }),
  getNextPageParam: (last) => (last?.hasMore ? (last.page || 1) + 1 : undefined),
  initialPageParam: 1,
});

export function useMessageEducators() {
  return useMutation({
    mutationFn: supervisorPortalApi.message,
    onSuccess: ({ sent = [], notReached = [] }) => {
      if (sent.length) toast.success(`Sent to ${sent.length === 1 ? sent[0] : `${sent.length} educators`}`);
      if (notReached.length) toast.error(`No sign-in for ${notReached.join(", ")} — they weren't reached`, { duration: 7000 });
    },
    onError: (err) => toast.error(errorText(err, "The message couldn't be sent")),
  });
}
