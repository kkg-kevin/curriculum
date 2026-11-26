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

// "Add missing classes" — a class for each cohort the curriculum has gained since the hub was added.
export function useAddMissingClasses(bootcampId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offeringId) => bootcampApi.addMissingClasses(bootcampId, offeringId),
    onSuccess: ({ added }) => {
      qc.invalidateQueries({ queryKey: BOOTCAMP_HUB_KEYS.byBootcamp(bootcampId) });
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success(added.length ? `Added ${added.map((c) => c.gradeName).join(", ")}` : "Every cohort already has a class here");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Couldn't add the classes"),
  });
}

// Learners of earlier runs of this bootcamp, and moving the chosen ones into this run.
export function useReturningLearners(bootcampId, enabled = true) {
  return useQuery({
    queryKey: ["bootcamps", "returning", bootcampId],
    queryFn: () => bootcampApi.returning(bootcampId),
    enabled: !!bootcampId && enabled,
  });
}

export function useBringBackLearners(bootcampId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => bootcampApi.bringBack(bootcampId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bootcamps", "returning", bootcampId] });
      qc.invalidateQueries({ queryKey: BOOTCAMP_HUB_KEYS.byBootcamp(bootcampId) });
      qc.invalidateQueries({ queryKey: ["bootcamps"] });
      qc.invalidateQueries({ queryKey: ["learners"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Couldn't bring them back"),
  });
}
