import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { roomApi } from "../services/roomApi";

export function useRoomsByHub(hubId) {
  return useQuery({
    queryKey: ["rooms", "byHub", hubId],
    queryFn:  () => roomApi.getAll({ hubId }),
    enabled:  !!hubId,
  });
}

// Which of this hub's rooms are already booked at an overlapping time on the given day — lets
// the slot picker gray out a busy room before save time instead of only finding out from the
// 409 the server's hasConflict throws. Only enabled once a day + both times are actually picked
// in the form; excludeSlotId lets editing a slot ignore that slot's own current booking.
export function useRoomAvailability({ hubId, dayOfWeek, startTime, endTime, excludeSlotId }) {
  return useQuery({
    queryKey: ["rooms", "availability", hubId, dayOfWeek, startTime, endTime, excludeSlotId],
    queryFn:  () => roomApi.getAvailability({ hubId, dayOfWeek, startTime, endTime, excludeSlotId }),
    enabled:  !!hubId && !!dayOfWeek && !!startTime && !!endTime,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: roomApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room added");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to add room"),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => roomApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update room"),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: roomApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room removed");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to remove room"),
  });
}
