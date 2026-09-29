import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { accessApi } from "../services/accessApi";

const ROLES_KEY = ["access-roles"];
const errorMessage = (err, fallback) => err.response?.data?.message || err.message || fallback;

export function useAccessModules() {
  return useQuery({ queryKey: ["access-modules"], queryFn: accessApi.modules, staleTime: Infinity });
}

export function useAccessRoles() {
  return useQuery({ queryKey: ROLES_KEY, queryFn: accessApi.roles });
}

function useRoleMutation(mutationFn, success, failure) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ROLES_KEY });
      // Staff lists show each person's role name.
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
      toast.success(typeof success === "function" ? success(data) : success);
    },
    onError: (err) => toast.error(errorMessage(err, failure)),
  });
}

export const useCreateRole = () => useRoleMutation(accessApi.createRole, (role) => `Role "${role.name}" created`, "Could not create the role");
export const useUpdateRole = () => useRoleMutation(({ id, ...data }) => accessApi.updateRole(id, data), "Role updated — staff get the change on their next action", "Could not update the role");
export const useDeleteRole = () => useRoleMutation(accessApi.deleteRole, "Role deleted", "Could not delete the role");
