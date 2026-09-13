import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { bootcampApi } from "../services/bootcampApi";
import { BOOTCAMP_KEYS } from "./useBootcamps";

const BOOTCAMP_HUB_KEYS = {
  byBootcamp: (bootcampId) => ["bootcamps", "hubs", bootcampId],
};

export function useBootcampHubsQuery(bootcampId) {
  return useQuery({
    queryKey: BOOTCAMP_HUB_KEYS.byBootcamp(bootcampId),
    queryFn: () => bootcampApi.listHubs(bootcampId),
    enabled: !!bootcampId,
  });
}

export function useCreateBootcampHub(bootcampId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => bootcampApi.addHub(bootcampId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOTCAMP_HUB_KEYS.byBootcamp(bootcampId) });
      qc.invalidateQueries({ queryKey: BOOTCAMP_KEYS.detail(bootcampId) });
      toast.success("Bootcamp is now running at that hub");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to run bootcamp at hub"),
  });
}

export function useDeleteBootcampHub(bootcampId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offeringId) => bootcampApi.removeHub(bootcampId, offeringId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOTCAMP_HUB_KEYS.byBootcamp(bootcampId) });
      qc.invalidateQueries({ queryKey: BOOTCAMP_KEYS.detail(bootcampId) });
      toast.success("Removed from that hub");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to remove offering"),
  });
}
