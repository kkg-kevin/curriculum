import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { leadApi } from "../services/leadApi";

export const LEAD_KEYS = {
  all: ["leads"],
  list: (filters) => ["leads", "list", filters],
};

export function useLeadsQuery(filters = {}) {
  return useQuery({
    queryKey: LEAD_KEYS.list(filters),
    queryFn: () => leadApi.getAll(filters),
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => leadApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEAD_KEYS.all });
      toast.success("Updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update"),
  });
}
