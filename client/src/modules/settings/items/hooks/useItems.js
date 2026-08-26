import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { itemsApi } from "../services/itemsApi";

const STALE = 5 * 60 * 1000;

export const ITEMS_KEYS = { items: ["settings", "items"] };

export function useItems() {
  return useQuery({ queryKey: ITEMS_KEYS.items, queryFn: itemsApi.getItems, staleTime: STALE });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: itemsApi.createItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ITEMS_KEYS.items }); toast.success("Item created"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create item"),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => itemsApi.updateItem(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ITEMS_KEYS.items }); toast.success("Item updated"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update item"),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: itemsApi.deleteItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ITEMS_KEYS.items }); toast.success("Item deleted"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete item"),
  });
}
