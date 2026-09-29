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
      queryClient.invalidateQueries({ queryKey: ["access-roles"] });
      toast.success(`Invited ${collaborator.email}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to invite collaborator"),
  });
}

export function useUpdateCollaboratorModules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allowedModules }) => collaboratorsApi.update(id, { allowedModules }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Collaborator access updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update collaborator"),
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

// Gives a staff member a different role (Settings → Roles & access defines the roles).
export function useUpdateCollaboratorRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleId }) => collaboratorsApi.update(id, { roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["access-roles"] });
      toast.success("Role updated — it applies on their next action");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update role"),
  });
}
