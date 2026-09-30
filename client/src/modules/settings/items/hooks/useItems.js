import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { itemsApi } from "../services/itemsApi";

const STALE = 5 * 60 * 1000;

export const ITEMS_KEYS = {
  all: ["settings", "items"],
  list: (kind) => ["settings", "items", kind || "all"],
};

// Courses' and Projects' linked-materials lists embed Goods fields (name, category, image), so a
// Goods edit has to refresh them too.
const CROSS_MODULE_KEYS = [
  ["assessments", "inventory"],
  ["courses", "inventory"],
];

function invalidateEverywhere(qc) {
  qc.invalidateQueries({ queryKey: ITEMS_KEYS.all });
  CROSS_MODULE_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

// The whole catalog, or one kind ("goods" | "service").
export function useItems({ kind } = {}) {
  return useQuery({ queryKey: ITEMS_KEYS.list(kind), queryFn: () => itemsApi.getItems(kind), staleTime: STALE });
}

// Goods only — what Courses and Project assessments pick materials from.
export function useGoods() {
  return useItems({ kind: "goods" });
}

const KIND_NOUN = { goods: "Goods item", service: "Service" };
const noun = (kind) => KIND_NOUN[kind] || "Item";

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: itemsApi.createItem,
    onSuccess: (item) => { invalidateEverywhere(qc); toast.success(`${noun(item?.kind)} created`); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create item"),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => itemsApi.updateItem(id, data),
    onSuccess: (item, { data }) => {
      invalidateEverywhere(qc);
      toast.success(data?.kind ? `Moved to ${data.kind === "goods" ? "Goods" : "Services"}` : `${noun(item?.kind)} updated`);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update item"),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: itemsApi.deleteItem,
    onSuccess: () => { invalidateEverywhere(qc); toast.success("Item deleted"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete item"),
  });
}
