import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { workspaceUsersApi } from "../services/workspaceUsersApi";

const QUERY_KEY = ["workspace-users"];

export function useWorkspaceUsers() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: workspaceUsersApi.list });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }) => workspaceUsersApi.setActive(id, active),
    onSuccess: (user, { active }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(active ? `${user.name || "Account"} can sign in again` : `${user.name || "Account"} deactivated`);
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update the account"),
  });
}
