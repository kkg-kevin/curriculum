import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { bootcampApi } from "../services/bootcampApi";

export const BOOTCAMP_KEYS = {
  all:          ["bootcamps"],
  detail:       (id) => ["bootcamps", "detail", id],
  byCurriculum: (curriculumId) => ["bootcamps", "byCurriculum", curriculumId],
};

export function useBootcampsQuery(params) {
  return useQuery({
    queryKey: params?.curriculumId ? BOOTCAMP_KEYS.byCurriculum(params.curriculumId) : BOOTCAMP_KEYS.all,
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

export function useBootcampRunsQuery(id) {
  return useQuery({ queryKey: ["bootcamps", "runs", id], queryFn: () => bootcampApi.runs(id), enabled: !!id });
}

// "Schedule another run" — the caller says where to go next (the new run's page).
export function useScheduleBootcampRun(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => bootcampApi.scheduleRun(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOTCAMP_KEYS.all }),
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to schedule the run"),
  });
}

export function useBootcampParticipantsQuery(id, scope) {
  return useQuery({ queryKey: ["bootcamps", "participants", id, scope], queryFn: () => bootcampApi.participants(id, scope), enabled: !!id });
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
