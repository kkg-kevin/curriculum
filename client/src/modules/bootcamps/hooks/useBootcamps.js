import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { bootcampApi } from "../services/bootcampApi";

export const BOOTCAMP_KEYS = {
  all:     ["bootcamps"],
  detail:  (id) => ["bootcamps", "detail", id],
  byEvent: (eventId) => ["bootcamps", "byEvent", eventId],
};

export function useBootcampsQuery(params) {
  return useQuery({
    queryKey: params?.eventId ? BOOTCAMP_KEYS.byEvent(params.eventId) : BOOTCAMP_KEYS.all,
    queryFn: () => bootcampApi.getAll(params),
  });
}

export function useBootcampQuery(id) {
  return useQuery({
    queryKey: BOOTCAMP_KEYS.detail(id),
    queryFn: () => bootcampApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateBootcamp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bootcampApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOTCAMP_KEYS.all });
      toast.success("Bootcamp created!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create bootcamp"),
  });
}

export function useUpdateBootcamp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => bootcampApi.update(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: BOOTCAMP_KEYS.all });
      if (data?.id) qc.invalidateQueries({ queryKey: BOOTCAMP_KEYS.detail(data.id) });
      toast.success("Bootcamp updated!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update bootcamp"),
  });
}

export function useDeleteBootcamp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bootcampApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOTCAMP_KEYS.all });
      toast.success("Bootcamp deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete bootcamp"),
  });
}
