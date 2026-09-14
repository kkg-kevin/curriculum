import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { collaboratorsApi } from "../services/collaboratorsApi";

const QUERY_KEY = ["collaborators"];

export function useCollaborators() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: collaboratorsApi.list });
}

export function useInviteCollaborator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: collaboratorsApi.invite,
    onSuccess: (collaborator) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Invited ${collaborator.email} as a collaborator`);
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to invite collaborator"),
  });
}

export function useRevokeCollaborator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: collaboratorsApi.revoke,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Collaborator removed");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to remove collaborator"),
  });
}
