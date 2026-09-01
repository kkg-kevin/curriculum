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

export function useBulkInvoicePreview() {
  return useMutation({
    mutationFn: billingApi.previewBulk,
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Could not preview bulk invoices"),
  });
}

export function useCreateBulkInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.createBulk,
    onSuccess: () => { qc.invalidateQueries({ queryKey: BILLING_KEYS.all }); toast.success("Bulk invoices created and issued"); },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Could not create bulk invoices"),
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
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: BILLING_KEYS.all });
      qc.invalidateQueries({ queryKey: ["billing", "invoice", id] });
      qc.invalidateQueries({ queryKey: ["billing", "receipts"] });
      toast.success("Payment recorded");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Payment failed"),
  });
}

export function useReceiptsQuery() {
  return useQuery({ queryKey: ["billing", "receipts"], queryFn: billingApi.listReceipts });
}

export function useReceiptQuery(invoiceId, paymentId) {
  return useQuery({
    queryKey: ["billing", "receipt", invoiceId, paymentId],
    queryFn: () => billingApi.getReceipt(invoiceId, paymentId),
    enabled: !!invoiceId && !!paymentId,
  });
}

export function useStatementQuery(payerType, payerId, { from, to } = {}) {
  return useQuery({
    queryKey: ["billing", "statement", payerType, payerId, from || null, to || null],
    queryFn: () => billingApi.getStatement(payerType, payerId, { from, to }),
    enabled: !!payerType && !!payerId,
  });
}

// Customers is an admin-only endpoint (403 for every other role) — `enabled` lets a shared
// component mount the hook unconditionally without firing a doomed request for non-admins.
export function useCustomersQuery({ enabled = true } = {}) {
  return useQuery({ queryKey: ["billing", "customers"], queryFn: billingApi.listCustomers, enabled });
}

export function useCustomerQuery(hubId) {
  return useQuery({
    queryKey: ["billing", "customer", hubId],
    queryFn: () => billingApi.getCustomer(hubId),
    enabled: !!hubId,
  });
}
