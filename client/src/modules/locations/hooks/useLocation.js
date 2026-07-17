import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { locationApi } from "../services/locationApi";

export const LOCATION_KEYS = {
  all: ["locations"],
  list: (filters) => ["locations", "list", filters],
  detail: (id) => ["locations", "detail", id],
};

export function useLocationsQuery() {
  const filters = useSelector((state) => state.locations.filters);
  return useQuery({
    queryKey: LOCATION_KEYS.list(filters),
    queryFn: () => locationApi.getAll(filters),
  });
}

export function useAllLocationsQuery(params = {}) {
  return useQuery({
    queryKey: ["locations", "all", params],
    queryFn: () => locationApi.getAll(params),
  });
}

export function useLocationQuery(id) {
  return useQuery({
    queryKey: LOCATION_KEYS.detail(id),
    queryFn: () => locationApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: locationApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOCATION_KEYS.all });
      toast.success("Location created successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create location"),
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => locationApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: LOCATION_KEYS.all });
      if (data?.id) queryClient.invalidateQueries({ queryKey: LOCATION_KEYS.detail(data.id) });
      toast.success("Location updated successfully!");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update location"),
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: locationApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOCATION_KEYS.all });
      toast.success("Location deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete location"),
  });
}
