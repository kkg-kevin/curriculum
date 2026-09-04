import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { siteContentApi } from "../services/siteContentApi";

export const SITE_CONTENT_KEYS = {
  bootcamps: ["site-content", "bootcamps"],
  projects: ["site-content", "projects"],
};

/* ── Bootcamps ────────────────────────────────────────────────────────── */

export function useBootcampsQuery() {
  return useQuery({
    queryKey: SITE_CONTENT_KEYS.bootcamps,
    queryFn: () => siteContentApi.bootcamps.getAll(),
  });
}

export function useCreateBootcamp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: siteContentApi.bootcamps.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SITE_CONTENT_KEYS.bootcamps });
      toast.success("Bootcamp created successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create bootcamp"),
  });
}

export function useUpdateBootcamp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => siteContentApi.bootcamps.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SITE_CONTENT_KEYS.bootcamps });
      toast.success("Bootcamp updated successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update bootcamp"),
  });
}

export function useDeleteBootcamp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: siteContentApi.bootcamps.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SITE_CONTENT_KEYS.bootcamps });
      toast.success("Bootcamp deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete bootcamp"),
  });
}

/* ── Projects (courses, in the public site's terminology) ───────────────── */

export function useProjectsQuery() {
  return useQuery({
    queryKey: SITE_CONTENT_KEYS.projects,
    queryFn: () => siteContentApi.projects.getAll(),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: siteContentApi.projects.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SITE_CONTENT_KEYS.projects });
      toast.success("Project created successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create project"),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => siteContentApi.projects.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SITE_CONTENT_KEYS.projects });
      toast.success("Project updated successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update project"),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: siteContentApi.projects.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SITE_CONTENT_KEYS.projects });
      toast.success("Project deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete project"),
  });
}
