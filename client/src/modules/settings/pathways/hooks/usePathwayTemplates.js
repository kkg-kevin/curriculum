import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { pathwayTemplatesApi } from "../services/pathwayTemplatesApi";

const STALE = 5 * 60 * 1000;

export const PATHWAY_TEMPLATE_KEYS = {
  all: ["settings", "pathway-templates"],
};

// Unlike competencies, a pathway template is copied (not linked) into a curriculum on import —
// see the curriculum service's importPathway. So editing a template here only needs to refresh
// the template list itself (e.g. the "Import Template" picker); curricula that already imported
// a copy are intentionally left untouched.

export function usePathwayTemplates() {
  return useQuery({
    queryKey:  PATHWAY_TEMPLATE_KEYS.all,
    queryFn:   pathwayTemplatesApi.getAll,
    staleTime: STALE,
  });
}

// Settings → Pathways' read-only directory. Worked out from the curricula each time it's opened,
// so a pathway added, renamed or changed in a curriculum shows here straight away.
export function usePathwayDirectory({ enabled = true } = {}) {
  return useQuery({
    queryKey: [...PATHWAY_TEMPLATE_KEYS.all, "directory"],
    queryFn: pathwayTemplatesApi.getDirectory,
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

// Settings → Pathways → Website: show on the website, and the hubs it runs at.
export function useSetPathwayWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => pathwayTemplatesApi.setWebsite(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PATHWAY_TEMPLATE_KEYS.all });
      toast.success("Website settings saved");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Couldn't save the website settings"),
  });
}

export function useCreatePathwayTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pathwayTemplatesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PATHWAY_TEMPLATE_KEYS.all });
      toast.success("Pathway created");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create pathway"),
  });
}

export function useUpdatePathwayTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => pathwayTemplatesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PATHWAY_TEMPLATE_KEYS.all });
      toast.success("Pathway updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update pathway"),
  });
}

export function useDeletePathwayTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pathwayTemplatesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PATHWAY_TEMPLATE_KEYS.all });
      toast.success("Pathway deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete pathway"),
  });
}
