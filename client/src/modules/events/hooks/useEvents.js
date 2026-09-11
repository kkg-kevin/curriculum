import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { eventApi } from "../services/eventApi";

export const EVENT_KEYS = {
  all:          ["events"],
  detail:       (id) => ["events", "detail", id],
  byCurriculum: (curriculumId) => ["events", "byCurriculum", curriculumId],
};

export function useAllEventsQuery() {
  return useQuery({
    queryKey: EVENT_KEYS.all,
    queryFn:  () => eventApi.getAll(),
  });
}

// Every deployment (hub + dates) of one event curriculum — a curriculum can be deployed to
// more than one hub, or redeployed for a different run, so this is a list, not a single record.
export function useEventsByCurriculumQuery(curriculumId) {
  return useQuery({
    queryKey: EVENT_KEYS.byCurriculum(curriculumId),
    queryFn:  () => eventApi.getAll({ curriculumId }),
    enabled:  !!curriculumId,
  });
}

export function useEventQuery(id) {
  return useQuery({
    queryKey: EVENT_KEYS.detail(id),
    queryFn:  () => eventApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: eventApi.create,
    // Invalidating the "events" prefix also covers byCurriculum(id) queries below it.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENT_KEYS.all });
      toast.success("Event created successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create event"),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => eventApi.update(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: EVENT_KEYS.all });
      if (data?.id) qc.invalidateQueries({ queryKey: EVENT_KEYS.detail(data.id) });
      toast.success("Event updated successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update event"),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: eventApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENT_KEYS.all });
      toast.success("Event deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete event"),
  });
}
