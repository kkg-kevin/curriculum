import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { branchApi } from "../services/branchApi";

export const BRANCH_KEYS = {
  all: ["branches"],
  detail: (id) => ["branches", "detail", id],
};

export function useBranchesQuery() {
  return useQuery({
    queryKey: BRANCH_KEYS.all,
    queryFn: () => branchApi.getAll(),
  });
}

export function useBranchQuery(id) {
  return useQuery({
    queryKey: BRANCH_KEYS.detail(id),
    queryFn: () => branchApi.getById(id),
    enabled: !!id,
  });
}

// For a "branchAdmin" account — their own branch. Not enabled by default; callers gate this on
// the logged-in user's role.
export function useMyBranchQuery(enabled) {
  return useQuery({
    queryKey: ["branches", "mine"],
    queryFn: () => branchApi.getMine(),
    enabled: !!enabled,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => branchApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCH_KEYS.all });
      toast.success("Branch created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create branch"),
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => branchApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: BRANCH_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: BRANCH_KEYS.detail(data.id) });
      toast.success("Branch updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update branch"),
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => branchApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCH_KEYS.all });
      toast.success("Branch deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete branch"),
  });
}

export function useAssignBranchAdmin(branchId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => branchApi.assignAdmin(branchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCH_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BRANCH_KEYS.detail(branchId) });
      toast.success("Branch admin assigned");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to assign branch admin"),
  });
}

export function useUnassignBranchAdmin(branchId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => branchApi.unassignAdmin(branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCH_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BRANCH_KEYS.detail(branchId) });
      toast.success("Branch admin unassigned");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to unassign branch admin"),
  });
}
