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
export function useEmailInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.email,
    onSuccess: (data, id) => { qc.invalidateQueries({ queryKey: ["billing", "invoice", id] }); toast.success(data?.emailedTo ? `Invoice emailed to ${data.emailedTo}` : "Invoice emailed"); },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Could not email the invoice"),
  });
}
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

// Whether M-Pesa is set up on this server (its Paybill number, for "pay by hand" instructions).
// Rarely changes, so it's cached for the session.
export function useMpesaStatus({ enabled = true } = {}) {
  return useQuery({ queryKey: ["billing", "mpesa", "status"], queryFn: billingApi.mpesaStatus, enabled, staleTime: 30 * 60 * 1000, retry: false });
}

export function useMpesaTransactions(params = {}) {
  return useQuery({
    queryKey: ["billing", "mpesa", "transactions", params],
    queryFn: () => billingApi.mpesaTransactions(params),
    // While a status check or reversal waits for Safaricom's answer, look again every few seconds.
    refetchInterval: (query) => (query.state.data?.transactions?.some((tx) => tx.operations?.some((op) => op.status === "pending")) ? 5000 : false),
  });
}

export function useMpesaFailedRequests() {
  return useQuery({ queryKey: ["billing", "mpesa", "failed"], queryFn: billingApi.mpesaFailedRequests });
}

function mpesaAction(mutationFn, successMessage) {
  return () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["billing", "mpesa"] });
        qc.invalidateQueries({ queryKey: BILLING_KEYS.all });
        qc.invalidateQueries({ queryKey: ["billing", "receipts"] });
        toast.success(successMessage);
      },
      onError: (err) => toast.error(err.response?.data?.message || err.message || "Something went wrong"),
    });
  };
}

export const useMpesaAllocate = mpesaAction(({ id, invoice }) => billingApi.mpesaAllocate(id, invoice), "Payment put on the invoice");
export const useMpesaIgnore = mpesaAction(({ id, note }) => billingApi.mpesaIgnore(id, note), "Payment set aside");
export const useMpesaCheck = mpesaAction((id) => billingApi.mpesaCheck(id), "Asked M-Pesa — the answer appears here in a moment");
export const useMpesaReverse = mpesaAction(({ id, note }) => billingApi.mpesaReverse(id, note), "Reversal sent to M-Pesa");
export const useMpesaStatementImport = mpesaAction((csv) => billingApi.mpesaStatementImport(csv), "Statement imported");

export function useMpesaStatementPreview() {
  return useMutation({
    mutationFn: (csv) => billingApi.mpesaStatementPreview(csv),
    onError: (err) => toast.error(err.response?.data?.message || err.message || "The statement couldn't be read"),
  });
}

// Billing → To confirm.
export function usePaymentNotices(params = {}) {
  return useQuery({ queryKey: ["billing", "payment-notices", params], queryFn: () => billingApi.paymentNotices(params) });
}

function noticeAction(mutationFn, successMessage) {
  return () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["billing", "payment-notices"] });
        qc.invalidateQueries({ queryKey: BILLING_KEYS.all });
        qc.invalidateQueries({ queryKey: ["billing", "receipts"] });
        toast.success(successMessage);
      },
      onError: (err) => toast.error(err.response?.data?.message || err.message || "Something went wrong"),
    });
  };
}

export const useConfirmPaymentNotice = noticeAction(({ id, ...data }) => billingApi.confirmPaymentNotice(id, data), "Payment confirmed and recorded");
export const useRejectPaymentNotice = noticeAction(({ id, reason }) => billingApi.rejectPaymentNotice(id, reason), "Payment rejected — the family has been told");

// Billing → Orders.
export function useOrders(params = {}) {
  return useQuery({ queryKey: ["billing", "orders", params], queryFn: () => billingApi.orders(params) });
}

export function useOrder(id) {
  return useQuery({ queryKey: ["billing", "orders", "one", id], queryFn: () => billingApi.order(id), enabled: Boolean(id) });
}

export function useSetOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => billingApi.setOrderStatus(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing", "orders"] });
      qc.invalidateQueries({ queryKey: BILLING_KEYS.all });
      toast.success("Order updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Something went wrong"),
  });
}
