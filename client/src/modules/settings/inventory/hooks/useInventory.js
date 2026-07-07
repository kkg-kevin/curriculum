import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { inventoryApi } from "../services/inventoryApi";

const STALE = 5 * 60 * 1000;

export const INVENTORY_KEYS = {
  items: ["settings", "inventory"],
};

const CROSS_MODULE_KEYS = [
  ["assessments", "inventory"],
];

function invalidateEverywhere(qc) {
  qc.invalidateQueries({ queryKey: INVENTORY_KEYS.items });
  CROSS_MODULE_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function useInventory() {
  return useQuery({ queryKey: INVENTORY_KEYS.items, queryFn: inventoryApi.getInventoryItems, staleTime: STALE });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createInventoryItem,
    onSuccess: () => { invalidateEverywhere(qc); toast.success("Inventory item created"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create inventory item"),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => inventoryApi.updateInventoryItem(id, data),
    onSuccess: () => { invalidateEverywhere(qc); toast.success("Inventory item updated"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update inventory item"),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.deleteInventoryItem,
    onSuccess: () => { invalidateEverywhere(qc); toast.success("Inventory item deleted"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete inventory item"),
  });
}
