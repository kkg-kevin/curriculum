import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { sharingApi } from "../services/sharingApi";

const CONNECTIONS_KEY = ["sharing", "connections"];
const errorMessage = (err, fallback) => err.response?.data?.message || err.message || fallback;

export function useSharingKinds() {
  return useQuery({ queryKey: ["sharing", "kinds"], queryFn: sharingApi.kinds, staleTime: Infinity });
}

export function useConnections() {
  return useQuery({ queryKey: CONNECTIONS_KEY, queryFn: sharingApi.connections });
}

function useConnectionMutation(mutationFn, success, failure) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
      toast.success(typeof success === "function" ? success(data) : success);
    },
    onError: (err) => toast.error(errorMessage(err, failure)),
  });
}

export const useRequestConnection = () => useConnectionMutation(
  sharingApi.request,
  (connection) => (connection.status === "accepted" ? `You're now connected with ${connection.admin.name}` : `Request sent to ${connection.admin.email}`),
  "Could not send the request",
);
export const useAcceptConnection = () => useConnectionMutation(sharingApi.accept, (connection) => `You're now connected with ${connection.admin.name}`, "Could not accept the request");
export const useRemoveConnection = () => useConnectionMutation(sharingApi.remove, (data) => data.message || "Removed", "Could not remove it");

export function useSharedContent(connectionId, kind) {
  return useQuery({
    queryKey: ["sharing", "content", connectionId, kind],
    queryFn: () => sharingApi.browse(connectionId, kind),
    enabled: Boolean(connectionId && kind),
  });
}

// What was copied now belongs to this workspace, so every list that might show it is refreshed.
export function useCopyShared(connectionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, ids }) => sharingApi.copy(connectionId, kind, ids),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => toast.error(errorMessage(err, "Could not add these to your workspace")),
  });
}
