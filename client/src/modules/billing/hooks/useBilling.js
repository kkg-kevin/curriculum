import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { billingApi } from "../services/billingApi";

export const BILLING_KEYS = { all: ["billing", "invoices"] };

export function useInvoicesQuery() {
  return useQuery({ queryKey: BILLING_KEYS.all, queryFn: billingApi.list });
}

export function useInvoiceQuery(id) {
  return useQuery({
    queryKey: ["billing", "invoice", id],
    queryFn: () => billingApi.get(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: BILLING_KEYS.all }); toast.success("Invoice saved as draft"); },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Could not create invoice"),
  });
}

function invoiceAction(action, successMessage) {
  return () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: action,
      onSuccess: (_data, id) => { qc.invalidateQueries({ queryKey: BILLING_KEYS.all }); qc.invalidateQueries({ queryKey: ["billing", "invoice", id] }); toast.success(successMessage); },
      onError: (err) => toast.error(err.response?.data?.message || err.message || "Billing action failed"),
    });
  };
}

export const useIssueInvoice = invoiceAction(billingApi.issue, "Invoice issued");
export const useCancelInvoice = invoiceAction(billingApi.cancel, "Invoice cancelled");
export function usePayInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => billingApi.pay(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: BILLING_KEYS.all }); toast.success("Payment recorded"); },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Payment failed"),
  });
}
