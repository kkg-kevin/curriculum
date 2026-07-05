import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { templateApi } from "../services/templateApi";

export const TEMPLATE_KEYS = {
  all: ["assessment-templates"],
  byType: (type) => ["assessment-templates", type],
};

export function useTemplates(type) {
  return useQuery({
    queryKey: type ? TEMPLATE_KEYS.byType(type) : TEMPLATE_KEYS.all,
    queryFn: () => templateApi.getAll(type),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: templateApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.all });
      toast.success("Template created");
    },
    onError: (err) => toast.error(err.message || "Failed to create template"),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => templateApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.all });
      toast.success("Template updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update template"),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: templateApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.all });
      toast.success("Template deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete template"),
  });
}
