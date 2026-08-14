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
